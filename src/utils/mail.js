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
			config.mail_transport,
			// Mail defaults 
			{ 
				from: `${config.appName} <${config.support_email}>` 
			});
		let res = await transport.verify();
		/* istanbul ignore next */
		if (!res) {
			logger.error('Transport verify failed (nodemailer)');
			throw 'Verify failed';
		}
		transport.use('compile', htmlToText(htmlToTextOptions));
		// });
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
			logger.error(error,'Outgoing Mail verify error');
		}
	}
	return async function mailer(options) {
		if(!transport) {
			try {
				await initTransport(config, logger);
			} catch(error) {
				logger.error(error,'Outgoing Mail verify error');
				return false;
			}
		}
		let mailBody = options.text, res;
		if (options.template) {
			let tpl = Handlebars.compile(`{{ localizedFile '${options.template}' }}`, { noEscape: true }),
				context = templateGlobalContext(config, options.locale || 'en');
			mailBody = tpl({ ...context, ...options.context, to: options.to});
		}
		if(!transport) {
			throw EXCEPTIONS.MAIL_NOT_READY;
		}
		if(!mailBody) {
			throw EXCEPTIONS.EMPTY_MAIL_BODY;
		}
		res = await transport.sendMail({
			to: options.to,
			from: options.from || `${config.appName} <${config.support_email}>`, //`"Tag Owner <tag-${tag._id}@lnf.z720.net>`,
			subject: `${config.appName}: ${options.subject || 'Notification'}`, //`Lost n Found: Instructions for ${tag.name} (${tag._id})`,
			html: mailBody
		});
		logger.debug({ function: 'sendmail', res });
		return res;
	};
}