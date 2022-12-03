const fastify = require('fastify')({
	trustProxy: true
});
const routes = {
	tags: require('./routes/v1/tags.js')
};
fastify.register(routes.tags, {prefix: '/api/1/tag'});

const start = async () => {
	try {
		const PORT = process.env.PORT || 3000
		await fastify.listen({
			port: PORT
		});
		console.log('Server started', PORT )
	} catch(err) {
		fastify.log.error((err))
		process.exit(1)
	}
}
start()