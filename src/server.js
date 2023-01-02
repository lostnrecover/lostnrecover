// Fastify
import Fastify from 'fastify';
import { loadFastifyPlugins, errorHandler } from './plugins.js'
import { config } from './config.js';

import * as TagsAPI from './routes/v1/tags.js'
import * as Users from './routes/v1/accounts.js'
import * as TagsEditController from './routes/tags-edit.js'
import * as TagsController from './routes/tags.js'
import * as Client from './routes/client.js';
import * as Admin from './routes/admin.js'

// Basic server
const fastify = Fastify({
	trustProxy: true,
	logger: true,
	ignoreTrailingSlash: true
});

// Init server extensions
loadFastifyPlugins(fastify, config);

// Init routes
fastify.setErrorHandler(errorHandler)
fastify.register(Users, {});
fastify.register(Client);
fastify.register(Admin);
fastify.register(TagsController, { prefix: '/t' });
fastify.register(TagsEditController, { prefix: '/tags'});
fastify.register(TagsAPI, {prefix: '/api/1/tags'});

// Start server
const start = async () => {
	try {
		await fastify.listen({
			port: config.PORT,
			host: config.HOST
		});
		console.log('Server started', config.PORT )
	} catch(err) {
		fastify.log.error((err))
		process.exit(1)
	}
}
start()