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
			reply.view('tag/new', { tag })
		} else {
			let tags = await TAGS.findForUser(req.session.get('email'));
			reply.view('tag/list', { tags });
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
			reply.code(404).view('tag/notfound');
		}
		// fastify.log.info(request.session.get('email'), tag.owner, request.query.edit)
		if (request.session.get('email') != tag.owner) {
			// Not the tag owner : redirect to the view path
			reply.redirect(`/t/${tagId}`);
			// reply.view('tag/found', { tag });
			return reply
		}
		if (request.query.edit) {
			reply.view('tag/edit', { tag });
		} else {
			reply.view('tag/view', { tag });
		}
		return reply;
	});
	fastify.post('/:tagId', { schema: TAGS.SCHEMA, preHandler: AUTH.authentified }, async (request, reply) => {
		let tag = await TAGS.get(request.params.tagId);
		if (!tag) {
			return reply.code(404)
		}
		TAGS.update(request.params.tagId, request.body);
		reply.redirect(request.url);
	})
	done()
}
