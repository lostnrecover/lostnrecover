// Fastify
import Fastify from 'fastify';
import * as MongoDB from '@fastify/mongodb';
import * as fastifySession from '@fastify/secure-session'
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt'
import * as fastifyView from '@fastify/view';
import * as fastifyStatic from '@fastify/static';
import fastifyForm from '@fastify/formbody';

// Templating
import Handlebars from 'handlebars';
import * as enLocale from './templates/locales/en.json' assert { type: "json" };

// current dir for options
import path from 'path'
import url from 'url';
import fs from 'fs';
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

fastify.register(fastifyCookie);
// fastify.register(fastifySession, {secret: process.env.SESSION_SECRET || 'a secret with minimum length of 32 characters'});
fastify.register(fastifySession, {
  // the name of the session cookie, defaults to 'session'
  cookieName: 'lostnfound',
  // adapt this to point to the directory where secret-key is located
  key: fs.readFileSync(path.join(__dirname, '../.session-secret-key')),
  cookie: {
    path: '/'
    // options for setCookie, see https://github.com/fastify/fastify-cookie
  }
})
fastify.register(fastifyJwt, {
  secret: fs.readFileSync(path.join(__dirname, '../.jwt-secret'))
})
fastify.register(fastifyView, {
	engine: {
		handlebars: Handlebars
	},
	root: path.join(__dirname, './templates'),
	layout: '_layout.hbs'
});
fastify.addHook("preHandler", function (request, reply, done) {
  reply.locals = {
    session: {
			email: request.session.get('email') || false
		}
  };
  done();
});
Handlebars.registerHelper("__", function(key) {
	// console.log('helper', typeof key)
	return enLocale.default[key] || `${key}`;
});
fastify.register(fastifyStatic, {
	root: path.join(__dirname, '../public'),
	prefix: '/public/'
});
fastify.register(fastifyForm);
fastify.register(Client);
fastify.register(Tags, {prefix: '/api/1'});
fastify.register(Users, {});

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