import {TagService} from '../../services/tags.js'

export default function(fastify, opts, done) {
	const SERVICE = TagService(fastify.mongo.db, 'admin')
	fastify.post('/tags', {
		schema: SERVICE.SCHEMA
	}, async (req, res) => {
		//TODO check match active session
		let tag = req.body;
		// Extract user and add it to the tag
		if (true) {
			tag.owner = 'admin';
		}
		let result = await SERVICE.create(tag)
		if(result) {
			fastify.log.info('New Tag', result._id)
			res.redirect(`/api/1/tags/${tag.id}`).send(t);
		} else {
			res.code(500).send({ error: 'save not acknowleded' })
		}
	});
	fastify.get('/tags', async (req, res) => {
		return SERVICE.findAll();
	});
	fastify.delete('/tags/inconsistent', async (req, res) => {
		let filter = { status: null };
		return SERVICE.remove(filter);
	})
	fastify.get('/tags/:id', (req,res) => {
		return SERVICE.get(req.params.id)
	});
	fastify.post('/tags/:id/notify', (req,res) => {
		return SERVICE.notify(req.params.id)
	});
	done();
}
