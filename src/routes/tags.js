import path from 'path'
import { EXCEPTIONS } from '../services/exceptions.js';
import { TagService, STATUS } from '../services/tags.js';
import { DiscoveryService } from '../services/discovery.js';
import { AuthTokenService } from '../services/authtoken.js';
import { UserService } from '../services/user.js';
import { MessageService } from '../services/messages.js';

// TODO: review authentication
export default async function (fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'Tags' }),
		TAGS = await TagService(fastify.mongo.db, logger, fastify.config),
		DISCOVERY = await DiscoveryService(fastify.mongo.db, logger, fastify.config),
		AUTH = await AuthTokenService(fastify.mongo.db, logger, fastify.config),
		USERS = await UserService(fastify.mongo.db, logger, fastify.config),
		MSG = await MessageService(fastify.mongo.db, logger, fastify.config);

	fastify.get('/:tagId', async (request, reply) => {
		let tag = await TAGS.get(request.params.tagId);
		if (!tag) {
			throw EXCEPTIONS.TAG_NOT_FOUND;
		}
		if(tag.status == STATUS.NEW && !tag.owner_id) {
			let data = { tag, title: 'Take tag ownership' };
			if(!request.session || !request.session.get('id')) {
				// throwWithData(EXCEPTIONS.NOT_AUTHORISED, { warning: 'You must be registered to take ownership.' })
				data.warning = 'You must be registered to take ownership.';
			}
			reply.view('tag/take-ownership', data);
			return reply;
		}
		if(![STATUS.ACTIVE, STATUS.LOST].includes(tag.status)) {
			throw EXCEPTIONS.TAG_NOT_FOUND;
		}
		if(request.isCurrentUser(tag.owner_id)) {
			// owner should see the edit/admin page
			reply.redirect(`/tags/${tag._id}`)
		} else {
			reply.view('tag/found', { tag, title: 'Tag' });
		}
		return reply;
	});

	fastify.post('/:tagId/active', {
		preHandler: AUTH.authentified
	}, async (request, reply) => {
		let tag = await TAGS.get(request.params.tagId);
		if (!tag) {
			throw EXCEPTIONS.TAG_NOT_FOUND;
		}
		if(tag.status == STATUS.NEW && !tag.owner_id) {
			// Set current user as owner
			tag.owner_id = request.currentUserId();
			tag.status = STATUS.ACTIVE;
			await TAGS.update(tag._id, tag)
			// redirect ot tag page for edit
			reply.redirect(`/tags/${tag._id}`)
		} else {
			reply.redirect(`/t/${tag._id}`);
		}
		return reply;
	});

	fastify.post('/:tagId/notify', async (request, reply) => {
		// TODO Review if action should be authenticated ?
		let tag = await TAGS.get(request.params.tagId),
			disc, redirect,
			email = request.session.get('email') || request.body.email,
			finder = await USERS.findOrCreate(email, 'finder');
		if (!tag) {
			throw EXCEPTIONS.TAG_NOT_FOUND;
		}
		if (request.isCurrentUser(tag.owner_id)) {
			// You can't get notified for your own tag ?
			throw(EXCEPTIONS.CANNOT_NOTIFY_OWNER)
		}
		// create a discovery (and eventually notify owner)
		disc = await DISCOVERY.create(tag, finder._id, tag.recipient_id || tag.owner_id, request.body.share)
		redirect = path.join(request.url, `/${disc._id}`);
		if (!request.session || !request.session.get('email')) {
			// User not logged in:
			// 1. findOrCreate userr account
			let user = await USERS.findOrCreate(email, 'discovery');
			// 2. generate a token
			const token = await AUTH.create(user.email);
			// 3. magiclink should redirect to -> path.join(request.url, `/${disc._id}`)
			let link = `${request.protocol}://${request.hostname}/auth?token=${token}&redirect=${redirect}`;
			// 4. send him a magiclink
			MSG.create({
				to: email,
				subject: 'Please verify your email',
				template: 'mail/email_verify',
				context: { link, token, email },
			});
			// 5. redirect to token check page (without the token ;)
			reply.redirect(`${request.protocol}://${request.hostname}/auth?email=${email}&redirect=${redirect}`);
		} else {
			// user already logged in and not the owner: redirect
			reply.redirect(redirect);
		}
		return reply
	});

	fastify.get('/:tagId/notify/:notificationId', {
		preHandler: AUTH.authentified
	}, async (request, reply) => {
		let discovery,isFinder,isTagOwner,view,
			viewmapfinder = {
				'new': 'notified',
				'pending': 'notified',
				'active': 'instructions',
				'returned': 'instructions',
				'recovered': 'closed',
				'rejected': 'closed'
			},
			viewmapowner = {
				'new': 'pending',
				'pending': 'pending',
				'active': 'instructions',
				'returned': 'instructions',
				'recovered': 'closed',
				'rejected': 'closed'
			}
		discovery = await DISCOVERY.get(request.params.notificationId);
		if (!discovery) {
			throw EXCEPTIONS.TAG_NOT_FOUND;
		}
		isFinder = request.isCurrentUser(discovery.finder_id);
		isTagOwner = request.isCurrentUser(discovery.owner_id);
		// Only visible from owner, recipient or finder
		if (!request.isCurrentUser([discovery.tag.recipient_id, discovery.owner_id, discovery.finder_id])) {
			throw EXCEPTIONS.NOT_FOUND;
		}
		if(request.isCurrentUser(discovery.finder_id)) {
			// finder view
			view = viewmapfinder[discovery.status]
		} else if(
			// owner or recipient view
			request.isCurrentUser(discovery.owner_id)
			|| request.isCurrentUser(discovery.tag.recipient_id)
			) {
			view = viewmapowner[discovery.status]
		}
		if(!view) {
			throw EXCEPTIONS.NOT_FOUND;
		}
		// TODO Review flow
		// if new: user was not logged in: propose to resubmit the dscovery
		// if pending: when tag status was not declared lost,
		//    if owner: approve the lost status of tag
		//    if finder: display info that owner has been notified
		// if active: display instructions, propose to declare return (finder) or reception (owner)
		// if closed: display status
		reply.view(`tag/discovery/${view}`, {title: 'Discovery', /*tag,*/ discovery, isFinder, isTagOwner});
		return reply;
	});

	fastify.post('/:tagId/notify/:notificationId', {
		preHandler: AUTH.authentified
	}, async (request, reply) => {
		let tag = await TAGS.get(request.params.tagId),
			discovery = await DISCOVERY.get(request.params.notificationId),
			isFinder = request.isCurrentUser(discovery.finder_id),
			isTagOwner = request.isCurrentUser(tag.owner_id);
		if(isFinder && request.body.action == 'return') {
			await DISCOVERY.flagReturned(discovery._id);
		} else if(isTagOwner && request.body.action == 'close') {
			await DISCOVERY.close(discovery._id);
		} else if(isTagOwner && request.body.action == 'approve') {
			await DISCOVERY.activate(discovery._id);
		} else if(isTagOwner && request.body.action == 'reject' ) {
			await DISCOVERY.reject(discovery._id);
		} else {
			throw EXCEPTIONS.BAD_REQUEST;
		}
		reply.redirect(`/t/${tag._id}/notify/${discovery._id}`);
		return reply;
	});

	done();
}
