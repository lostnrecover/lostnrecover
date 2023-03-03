import { STATUS, TagService } from '../services/tags.js'
import { AuthTokenService } from '../services/authtoken.js';
import { UserService } from '../services/user.js';
import { EXCEPTIONS } from '../services/exceptions.js';

export default function (fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'TagsEdit' }),
		TAGS = TagService(fastify.mongo.db, logger, fastify.config),
		AUTH = AuthTokenService(fastify.mongo.db, logger, fastify.config),
		USERS = UserService(fastify.mongo.db, logger, fastify.config);

	async function filterInput(request, tag) {
		tag.name = request.body.name || '';
		tag.label = request.body.label || '';
		tag.responseText = request.body.responseText || '';
		if(request.body.email !== request.session.get('email')) {
			let recipient = await USERS.findOrCreate(request.body.email, 'recipient');
			tag.recipient_id = recipient._id;
		} else {
			tag.recipient_id = request.currentUserId();
		}
		return tag;
	}
	fastify.get('/', {
		preHandler: AUTH.authentified
	}, async (req, reply) => {
		if (req.query.create) {
			let tag = {
				// Default tag owner to current session
				email: req.session.get('email')
			}
			reply.view('tag/new', { tag, title: 'Create a Tag' })
		} else {
			let tags = await TAGS.findForUser(req.currentUserId());
			reply.view('tag/list', { tags, title: 'Tags' });
		}
		return reply
	});
	fastify.post('/',{ schema: TAGS.SCHEMA, preHandler: AUTH.authentified }, async (request, reply) => {
		let newTag = request.body;
		newTag.owner_id = request.currentUserId();
		let tag = await TAGS.create(newTag);
		reply.redirect(`/tags/${tag._id}?edit=1`)
	})
	fastify.get('/:tagId', {
		preHandler: AUTH.authentified
	}, async (request, reply) => {
		let tag = await TAGS.get(request.params.tagId), recipient = null;
		if (!tag) {
			reply.code(404).view('tag/notfound', { title: 'Tag not found'});
		}
		if (!request.isCurrentUser(tag.owner_id)) {
			// Not the tag owner : redirect to the view path
			reply.redirect(`/t/${tag._id}`);
			// reply.view('tag/found', { tag });
			return reply
		}
		// Show recipient email
		if(tag.recipient_id) {
			recipient = await USERS.findById(tag.recipient_id);
			tag.email = recipient.email
		} else {
			tag.email = request.session.get('email');
		}
		if (request.query.edit) {
			reply.view('tag/edit', { tag, title: 'Edit tag' });
		} else {
			reply.view('tag/view', { tag, title: 'View Tag' });
		}
		return reply;
	});
	fastify.post('/:tagId', { schema: TAGS.SCHEMA, preHandler: AUTH.authentified }, async (request, reply) => {
		let tag = await TAGS.get(request.params.tagId);
		if (!tag) {
			return reply.code(404)
		}
		tag = await filterInput(request, tag);
		await TAGS.update(tag._id, tag);
		reply.redirect(request.url);
	});

	// TODO refactor with dynamic route
	fastify.post('/:tagId/lost', {
		preHandler: AUTH.authentified
	}, async (request, reply) => {
		let tag = await TAGS.get(request.params.tagId);
		if(!tag) {
			throw EXCEPTIONS.MISSING_TAG;
		}
		TAGS.update(tag._id, { status: STATUS.LOST });
		if(request.body.redirect) {
			reply.redirect(request.body.redirect);
		} else {
			reply.redirect(request.url.replace('/lost',''));
		}
		return reply;
	});
	fastify.post('/:tagId/active', {
		preHandler: AUTH.authentified
	}, async (request, reply) => {
		let tag = await TAGS.get(request.params.tagId);
		if(!tag) {
			throw EXCEPTIONS.MISSING_TAG;
		}
		TAGS.update(tag._id, { status: STATUS.ACTIVE });
		if(request.body.redirect) {
			reply.redirect(request.body.redirect);
		} else {
			reply.redirect(request.url.replace('/active',''));
		}
		return reply;
	});
	done()
}
