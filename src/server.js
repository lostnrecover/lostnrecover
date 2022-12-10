import Fastify from 'fastify';
import * as MongoDB from '@fastify/mongodb';

// current dir for options
import path from 'path'
import url from 'url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

import * as Tags from './routes/v1/tags.js'
import * as Users from './routes/v1/accounts.js'
import * as Client from './routes/client.js';

const fastify = Fastify({
	trustProxy: true,
	logger: true
});

fastify.register(MongoDB, {
  // force to close the mongodb connection when app stopped
  // the default value is false
  forceClose: true,
  url: 'mongodb://mongodb/lostnfound'
});

fastify.register(Client, { publicDir: path.join(__dirname, '../public'), templateDir: path.join(__dirname, './templates')})
fastify.register(Tags, {prefix: '/api/1'});
fastify.register(Users, {prefix: '/api/1'});

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