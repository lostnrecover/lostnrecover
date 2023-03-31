import * as MongoDB from '@fastify/mongodb';
import * as fastifySession from '@fastify/secure-session'
import fastifyCookie from '@fastify/cookie';
import * as fastifyView from '@fastify/view';
import * as fastifyStatic from '@fastify/static';
import * as fastifyFlash from '@fastify/flash';
import fastifyForm from '@fastify/formbody';

import fastifyMailer from 'fastify-mailer';
import { htmlToText } from 'nodemailer-html-to-text';

import pkg from '../../package.json' assert { type: "json" };

// current dir for options
// import path from 'path'

// Templating
import Handlebars from 'handlebars';
import { loadHelpers, loadPartials } from './templating.js';
import { EXCEPTIONS } from '../services/exceptions.js';

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

	function templateGlobalContext(locale) {
		let context = {
			config: fastify.config,
			locale,
			pkg,
			env: process.env.ENV
		}
		delete context.config.cookies;
		// delete context.config.mail_transport;
		return context;
	}

	// TODO outsource to a locale dedicated file
	fastify.addHook("preHandler", async function (request, reply) {
		if(!config.DOMAIN || config.DOMAIN == '') {
			config.DOMAIN = `${request.hostname}`
			request.log.info(`Switched domain: ${config.DOMAIN}`)
		}
		if (Object.keys(config.locales).indexOf(request.query.locale) > -1) {
			request.session.set('locale', request.query.locale)
		}
		reply.locals = templateGlobalContext(request.session.get('locale') || 'en');
		reply.locals.session = {
			email: request.session.get('email') || false,
			user_id: request.session.get('user_id') || false
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

	fastify.register(fastifyMailer, {
		defaults: { from: `${config.appName} <${config.support_email}>` },
		transport: {
			...config.mail_transport
		}
	});
	fastify.ready(err => {
		// executed only once after mailer init (all register ready)
		fastify.mailer.use('compile', htmlToText())
	})

	fastify.decorate('sendmail', (options) => {
		let mailBody = options.text;
		if (options.template) {
			let tpl = Handlebars.compile(`{{ localizedFile '${options.template}' }}`, { noEscape: true }),
				context = templateGlobalContext(options.locale || 'en');
			mailBody = tpl({ ...context, ...options.context, to: options.to})
		}
		if(!mailBody) {
			throw EXCEPTIONS.EMPTY_MAIL_BODY;
		}
		return fastify.mailer.sendMail({
			to: options.to,
			from: options.from || `${config.appName} <${config.support_email}>`, //`"Tag Owner <tag-${tag._id}@lnf.z720.net>`,
			subject: `${config.appName}: ${options.subject || 'Notification'}`, //`Lost n Found: Instructions for ${tag.name} (${tag._id})`,
			html: mailBody
		})
	});

}
