

export default async function (fastify, opts, done) {
	const 
		logger = fastify.log.child({ controller: 'Discoveries' }),
		services = fastify.services;

	// Get List
	fastify.get('/', {
		preHandler: fastify.authentified 
	}, async (request, reply) => {
		let discoveries = await services.DISC.listForFinder(request.currentUserId());
		reply.view('tag/discovery/list', { discoveries });
		return reply;
	});
	logger.debug('DiscoveriesRoute loaded');
	done();
}