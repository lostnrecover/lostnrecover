import {TagService} from '../../services/tags.js'
import { AuthTokenService } from '../../services/authtoken.js';

export default function(fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'TagApi' }),
	 	TAGS = TagService(fastify.mongo.db,  logger, fastify.config),
		AUTH = AuthTokenService(fastify.mongo.db, logger);

	// FIXME proper API
	fastify.post('/', {
		schema: TAGS.SCHEMA,
		preHandler: AUTH.authentified
	}, async (req, res) => {
		let tag = req.body;
		// Extract user and add it to the tag
		if (true) {
			tag.owner = 'admin';
		}
		let result = await TAGS.create(tag)
		if(result) {
			// fastify.log.info('New Tag', result._id)
			res.redirect(`/api/1/tags/${tag.id}`).send(t);
		} else {
			res.code(500).send({ error: 'save not acknowleded' })
		}
	});
	fastify.get('/', {
		preHandler: AUTH.authentified
	}, async (req, res) => {
		let tags = TAGS.findForUser(req.session.get('email'))
	});
	fastify.delete('/inconsistent', {
		preHandler: AUTH.authentified
	},async (req, res) => {
		let filter = { status: null };
		return TAGS.remove(filter);
	})
	fastify.get('/:id', {
		preHandler: AUTH.authentified
	},(req,res) => {
		return TAGS.get(req.params.id)
	});
	fastify.post('/:id/notify', {
		preHandler: AUTH.authentified
	},(req,res) => {
		return TAGS.notify(req.params.id)
	});
	done();
}
