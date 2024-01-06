import nodemailer from 'nodemailer';
import { htmlToText } from 'nodemailer-html-to-text';
import { EXCEPTIONS, throwWithData } from '../services/exceptions.js';
import { templateGlobalContext } from './templating.js';
import Handlebars from 'handlebars';

let transport = false;
// https://www.npmjs.com/package/html-to-text
const htmlToTextOptions = {};

export async function initTransport(config, logger) {
	try {
		transport = nodemailer.createTransport(
			// Connection string 
			config.smtp,
			// Mail defaults 
			{ 
				from: `${config.appName} <${config.smtp.from}>`,
				replyTo: config.support_email ?? config.smtp.from
			});
		let res = await transport.verify();
		/* istanbul ignore next */
		if (!res) {
			logger.error('Transport verify failed (nodemailer)');
			throw 'Verify failed';
		}
		transport.use('compile', htmlToText(htmlToTextOptions));
		// });
		logger.info(`Mail transport init: ${config.smtp.auth.user} / ${config.smtp.host}`);
	} catch(error) {
		transport = false;
		throwWithData(EXCEPTIONS.MAIL_NOT_READY, error);
	}
}

export async function getMailer(config, logger) {
	if(!transport) {
		try {
			await initTransport(config, logger);
		} catch(error) {
			/* istanbul ignore next */
			logger.error({ error,msg: 'Outgoing Mail verify error'});
		}
	}
	return async function mailer(message) {
		if(!transport) {
			try {
				await initTransport(config, logger);
			} catch(error) {
				logger.error(error,'Outgoing Mail verify error');
				return false;
			}
		}
		let mailBody = message.text, res, email;
		if (message.template) {
			let tpl = Handlebars.compile(`{{ localizedFile '${message.template}' }}`, { noEscape: true }),
				context = templateGlobalContext(config, message.locale || 'en');
			mailBody = tpl({ ...context, ...message.context, to: message.to});
		}
		if(!transport) {
			throw EXCEPTIONS.MAIL_NOT_READY;
		}
		if(!mailBody) {
			throw EXCEPTIONS.EMPTY_MAIL_BODY;
		}
		// TODO: check from within domain ?
		// TODO Default from from SMTP variable to ensure from match smtp account ?
		email = {
			to: message.to,
			// from: options.from || `${config.appName} <${config.support_email}>`, //`"Tag Owner <tag-${tag._id}@lnf.z720.net>`,
			subject: `${config.appName}: ${message.subject || 'Notification'}`, //`Lost n Found: Instructions for ${tag.name} (${tag._id})`,
			html: mailBody,
			headers: {
				'X-appName': `${config.appName}`
			}
		};
		// if(message.reference) {
		// 	email.headers['References'] = message.reference;
		// }
		if(message.replyTo) {
			email.replyTo = message.replyTo;
		}
		if(message.from) {
			// Config to switch between from / replyto
			if(config.smtp.impersonation) {
				email.from = message.from;
			} else {
				email.replyTo = message.from;
			}
		}
		res = await transport.sendMail(email);
		logger.debug({ function: 'sendmail', res });
		return res;
	};
}