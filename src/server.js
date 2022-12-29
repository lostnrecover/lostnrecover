// Fastify
import Fastify from 'fastify';
import { loadFastifyPlugins } from './plugins.js'

import * as TagsAPI from './routes/v1/tags.js'
import * as Users from './routes/v1/accounts.js'
import * as TagsEditController from './routes/tags-edit.js'
import * as TagsController from './routes/tags.js'
import * as Client from './routes/client.js';
import * as Admin from './routes/admin.js'
const fastify = Fastify({
	trustProxy: true,
	logger: true,
	ignoreTrailingSlash: true
});

loadFastifyPlugins(fastify);

fastify.setErrorHandler((error, request, reply) => {
	let e = error;
	if(typeof error == 'string') {
		e = {
			code: 500,
			details: error
		}
	} else if(!e.details && e.message) {
		e.details = e.message
	}
	fastify.log.error(error)
  // this IS called
  reply.code(e.code || 500)
	// if HTML
	if(e.redirect) {
		reply.redirect(e.redirect)
	} else {
		reply.view('error', {error: e})
	}
	// if json
	// reply.send(error)
})
fastify.register(Users, {});
fastify.register(Client);
fastify.register(Admin);
fastify.register(TagsController, { prefix: '/t' });
fastify.register(TagsEditController, { prefix: '/tags'});
fastify.register(TagsAPI, {prefix: '/api/1/tags'});

const start = async () => {
	try {
		const PORT = process.env.PORT || 3000
		await fastify.listen({
			port: PORT,
			host: '::'
		});
		console.log('Server started', PORT )
	} catch(err) {
		fastify.log.error((err))
		process.exit(1)
	}
}
start()