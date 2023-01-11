// Fastify
import Fastify from 'fastify';
import { loadFastifyPlugins, errorHandler } from './plugins.js';
import { config } from './config.js';
import qs from 'qs';

import * as TagsAPI from './routes/v1/tags.js';
import * as Auth from './routes/session.js';
import * as User from './routes/user.js';
import * as TagsEditController from './routes/tags-edit.js';
import * as TagsController from './routes/tags.js';
import * as Client from './routes/client.js';
import * as Admin from './routes/admin.js';
import * as PdfContoller from './routes/pdf.js';
import * as CodeController from './routes/code.js';

// Basic server
const fastify = Fastify({
	trustProxy: true,
	logger: true,
	ignoreTrailingSlash: true,
	querystringParser: str => qs.parse(str, { allowDots: true, allowSparse: true})
});

console.log('Load plugins...')
// Init server config and extensions
fastify.decorate('config', config)
loadFastifyPlugins(fastify, config);
fastify.setErrorHandler(errorHandler)

console.log('register routes...')
// Init routes
fastify.register(Auth);
fastify.register(Client);
fastify.register(Admin, { prefix: '/admin' });
fastify.register(TagsController, { prefix: '/t' });
fastify.register(TagsEditController, { prefix: '/tags'});
fastify.register(CodeController, { prefix: '/code' })
fastify.register(PdfContoller, { prefix: '/pdf' });
fastify.register(TagsAPI, { prefix: '/api/1/tags'});
fastify.register(User, { prefix: '/account' })

// Start server
const start = async () => {
	try {
		await fastify.listen({
			port: config.PORT,
			host: config.HOST
		});
		console.log(`Server started ${config.HOST}:${config.PORT}`)
	} catch(err) {
		fastify.log.error((err))
		process.exit(1)
	}
}
start()
