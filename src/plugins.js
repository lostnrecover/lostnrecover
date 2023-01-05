import * as MongoDB from '@fastify/mongodb';
import * as fastifySession from '@fastify/secure-session'
import fastifyCookie from '@fastify/cookie';
import * as fastifyView from '@fastify/view';
import * as fastifyStatic from '@fastify/static';
import fastifyForm from '@fastify/formbody';

import fastifyMailer from 'fastify-mailer';
import { htmlToText } from 'nodemailer-html-to-text';

import pkg from '../package.json' assert { type: "json" };

// current dir for options
import path from 'path'

// Templating
import Handlebars from 'handlebars';
import { loadHelpers, loadPartials } from './templating.js';
import { EXCEPTIONS } from './services/exceptions.js';

export function errorHandler(error, request, reply) {
	let e = error;
	if(typeof error == 'string') {
		e = {
			code: 500,
			details: error
		}
	} else if(!e.details && e.message) {
		e.details = e.message
	}
	request.log.error(error)
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
}

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

	function templateGlobalContext(locale) {
		let context = {
			config: fastify.config,
			locale,
			pkg,
		}
		delete context.config.cookies;
		delete context.config.mail_transport;
		return context;
	}

	// TODO outsource to a locale dedicated file
	fastify.addHook("preHandler", function (request, reply, done) {
		if(!config.DOMAIN || config.DOMAIN == '') {
			config.DOMAIN = request.hostname
			fastify.log.info(`Switched domain: ${config.DOMAIN}`)
		}
		if (Object.keys(config.locales).indexOf(request.query.locale) > -1) {
			request.session.set('locale', request.query.locale)
		}
		reply.locals = templateGlobalContext(request.session.get('locale') || 'en');
		reply.locals.session = {
			email: request.session.get('email') || false
		}
		done();
	});

	const TPL_DIR = config.template_dir
	fastify.register(fastifyView, {
		engine: {
			handlebars: Handlebars
		},
		root: TPL_DIR,
		layout: '_layout.hbs'
	});
	loadHelpers(Handlebars, TPL_DIR);
	loadPartials(Handlebars, TPL_DIR);
	fastify.register(fastifyStatic, {
		root: path.join(config.app_root_dir, '/public'),
		prefix: '/public/'
	});
	fastify.register(fastifyForm);

	// TODO: external configuration
	fastify.register(fastifyMailer, {
		defaults: { from: `${config.appName} <${config.support_email}>` },
		transport: {
			...config.mail_transport
		}
	});

	fastify.decorate('sendmail', (options) => {
		// TODO: move to be exceuted only once
		fastify.mailer.use('compile', htmlToText())
		let mailBody = options.text;
		if (options.template) {
			let tpl = Handlebars.compile(`{{ localizedFile '${options.template}' }}`, { noEscape: true }),
				context = templateGlobalContext(options.locale || 'en');
			mailBody = tpl({ ...context, ...options.context, to: options.to})
		}
		if(!mailBody) {
			throw EXCEPTIONS.EMPTY_MAIL_BODY;
		}
		fastify.mailer.sendMail({
			to: options.to,
			from: options.from || `${config.appName} <${config.support_email}>`, //`"Tag Owner <tag-${tag._id}@lnf.z720.net>`,
			subject: `${config.appName}: ${options.subject || 'Notification'}`, //`Lost n Found: Instructions for ${tag.name} (${tag._id})`,
			html: mailBody
		})
	});

}
