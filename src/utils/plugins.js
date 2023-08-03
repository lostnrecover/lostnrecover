import * as MongoDB from '@fastify/mongodb';
import * as fastifySession from '@fastify/secure-session'
import fastifyCookie from '@fastify/cookie';
import * as fastifyView from '@fastify/view';
import * as fastifyStatic from '@fastify/static';
import * as fastifyFlash from '@fastify/flash';
import fastifyForm from '@fastify/formbody';


// current dir for options
// import path from 'path'

// Templating
import Handlebars from 'handlebars';
import { loadHelpers, loadPartials, templateGlobalContext } from './templating.js';

export function loadFastifyPlugins(fastify, config) {

	fastify.register(MongoDB, {
		// force to close the mongodb connection when app stopped
		// the default value is false
		forceClose: true,
		url: config.db_url //'mongodb://mongodb/lostnfound'
	});

	fastify.register(fastifyCookie);

	fastify.register(fastifySession, {
		// the name of the session cookie, defaults to 'session'
		cookieName: config.cookies.name, //'lostnfound',
		// adapt this to point to the directory where secret-key is located
		key: config.cookies.secret, //fs.readFileSync(path.join(__dirname, '../.session-secret-key'))
		cookie: {
			path: '/'
			// options for setCookie, see https://github.com/fastify/fastify-cookie
		}
	})

	fastify.register(fastifyFlash);

	// TODO outsource to a locale dedicated file
	fastify.addHook("preHandler", async function (request, reply) {
		if(!config.DOMAIN || config.DOMAIN == '') {
			config.DOMAIN = `${request.hostname}`
			request.log.info(`Switched domain: ${config.DOMAIN}`)
		}
		if (Object.keys(config.locales).indexOf(request.query.locale) > -1) {
			request.session.set('locale', request.query.locale)
		}
		reply.locals = templateGlobalContext(config, request.session.get('locale') || 'en');
		reply.locals.session = {
			email: request.session.get('email') || false,
			user_id: request.session.get('user_id') || false,
			isAdmin: request.session.get('isAdmin') || false
		}
		// Only get flash for "main" request
		if(request.routerPath != "/public/*") {
			reply.locals.flash = reply.flash();
		}
		// done();
	});
	fastify.decorateRequest('isCurrentUser', function(user_refs) {
		let refs = Array.isArray(user_refs) ? user_refs : [ user_refs ];
		if(!this.session.get('email') || !this.session.get('user_id')) {
			return false;
		}
		return refs.includes(this.session.get('email')) || refs.includes(this.session.get('user_id'));
	});
	fastify.decorateRequest('currentUserId', function() {
		return this.session.get('user_id');
	});
	const TPL_DIR = config.template_dir
	fastify.register(fastifyView, {
		engine: {
			handlebars: Handlebars
		},
		root: TPL_DIR,
		layout: '_layout.hbs'
	});
	loadHelpers(fastify.log.child({ module: 'helpers' }), Handlebars, TPL_DIR);
	loadPartials(fastify.log.child({ module: 'partials' }), Handlebars, TPL_DIR);
	fastify.register(fastifyStatic, {
		root: config.public_dir,
		prefix: '/public/'
	});
	fastify.register(fastifyForm);


}
