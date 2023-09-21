import { SCHEMA } from '../../services/tags.js';

export default function(fastify, opts, done) {
	const 
		logger = fastify.log.child({ controller: 'TagApi' }),
		services = fastify.services;

	// FIXME proper API
	fastify.post('/', {
		schema: SCHEMA,
		preHandler: fastify.authentified
	}, async (req, res) => {
		let tag = req.body;
		// Extract user and add it to the tag
		if (true) {
			tag.owner = 'admin';
		}
		let result = await services.TAGS.create(tag)
		if(result) {
			// fastify.log.info('New Tag', result._id)
			res.redirect(`/api/1/tags/${tag.id}`).send(t);
		} else {
			res.code(500).send({ error: 'save not acknowleded' })
		}
	});
	fastify.get('/', {
		preHandler: fastify.authentified
	}, async (request, res) => {
		let tags = services.TAGS.findForUser(request.serverSession.user.email)
	});
	fastify.delete('/inconsistent', {
		preHandler: fastify.authentified
	},async (req, res) => {
		let filter = { status: null };
		return services.TAGS.remove(filter);
	})
	fastify.get('/:id', {
		preHandler: fastify.authentified
	},(req,res) => {
		return services.TAGS.get(req.params.id)
	});
	fastify.post('/:id/notify', {
		preHandler: fastify.authentified
	},(req,res) => {
		return services.TAGS.notify(req.params.id)
	});
	done();
}
