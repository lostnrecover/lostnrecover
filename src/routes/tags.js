import path from 'path'
import { EXCEPTIONS } from '../services/exceptions.js';
import { TagService } from '../services/tags.js';
import { DiscoveryService } from '../services/discovery.js';
import { AuthTokenService } from '../services/authtoken.js'
import { UserService } from '../services/user.js';

// TODO: review authentication
export default function (fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'Tags' }),
		TAGS = TagService(fastify.mongo.db, logger, fastify.config),
		DISCOVERY = DiscoveryService(fastify.mongo.db, logger, fastify.config, fastify.sendmail),
		AUTH = AuthTokenService(fastify.mongo.db, logger, fastify.config),
		USERS = UserService(fastify.mongo.db, logger, fastify.config);

	fastify.get('/:tagId', async (request, reply) => {
		let tag = await TAGS.get(request.params.tagId);
		if (!tag) {
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

	fastify.post('/:tagId/notify', async (request, reply) => {
		// TODO Review if action should be authenticated ?
		let tag = await TAGS.get(request.params.tagId),
			disc,
			email = request.session.get('email') || request.body.email,
			finder = await USERS.findOrCreate(email, 'finder');
		if (!tag) {
			throw EXCEPTIONS.TAG_NOT_FOUND;
		}
		if (!request.session || !request.session.get('email')) {
			// Check user identity with an email
		}
		if (request.isCurrentUser(tag.owner_id)) {
			// You can't get notified for your own tag ?
			throw(EXCEPTIONS.CANNOT_NOTIFY_OWNER)
		}
		disc = await DISCOVERY.create(tag, finder._id, tag.recipient_id || tag.owner_id, request.body.share)
		// tag.status = 'found';
		reply.redirect(path.join(request.url, `/${disc._id}`));
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
