import { TagService } from '../services/tags.js'
import { AuthTokenService } from '../services/authtoken.js';

export default function (fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'TagsEdit' }),
		TAGS = TagService(fastify.mongo.db, logger, fastify.config),
		AUTH = AuthTokenService(fastify.mongo.db, logger);

	fastify.get('/', {
		preHandler: AUTH.authentified
	}, async (req, reply) => {
		if (req.query.create) {
			let tag = {
				email: req.session.get('email')
			}
			reply.view('tag/new', { tag, title: 'Create a Tag' })
		} else {
			let tags = await TAGS.findForUser(req.session.get('email'));
			reply.view('tag/list', { tags, title: 'Tags' });
		}
		return reply
	});
	fastify.post('/',{ schema: TAGS.SCHEMA, preHandler: AUTH.authentified }, async (request, reply) => {
		let newTag = request.body;
		newTag.owner = request.session.get('email');
		let tag = await TAGS.create(newTag);
		reply.redirect(`/tags/${tag._id}?edit=1`)
	})
	fastify.get('/:tagId', {
		preHandler: AUTH.authentified
	}, async (request, reply) => {
		let tag = await TAGS.get(request.params.tagId);
		if (!tag) {
			reply.code(404).view('tag/notfound', { title: 'Tag not found'});
		}
		if (!request.isCurrentUser(tag.owner)) {
			// Not the tag owner : redirect to the view path
			reply.redirect(`/t/${tag._id}`);
			// reply.view('tag/found', { tag });
			return reply
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
		TAGS.update(tag._id, request.body);
		reply.redirect(request.url);
	})
	done()
}
