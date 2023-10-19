import { test } from 'tap';
import pino from 'pino';
// import Handlebars from 'handlebars';
import { getMailer, initTransport } from '../../src/utils/mail.js';
import { config } from '../../src/config.js';
import { EXCEPTIONS } from '../../src/services/exceptions.js';
// import { loadHelpers } from '../../src/utils/templating.js';

const FAKELOGGER = pino({
	file: '/dev/null'
});

test('Mail Management', async (t) => {
	// t.before(
	// 	loadHelpers(FAKELOGGER, Handlebars, config.template_dir)
	// )
	t.test('Mail bad config', async (t) => {
		try {
			await initTransport({
				mail_transport: {
					host: 'smtp.ethereal.mail',
					port: 587,
					secure: false,
					auth: {
						user: 'nobody',
						pass: 'nopassword'
					}
				},
			}, FAKELOGGER);
			t.fail('Should have sent an excpetion');
		} catch(e) {
			t.equal(e.message, 'Mail server not ready to send email');
			t.pass();
		}
	});
	t.test('Send an email', async (t) => {
		let mailer = await getMailer(config, FAKELOGGER),
			res = await mailer({
				to: 'recipient@example.com',
				from: 'sender@example.com',
				subject: 'Test',
				text: 'Mail body not null'
			});
		t.equal(res.accepted[0], 'recipient@example.com', ' accepted to recipient');
		t.equal(res.rejected.length, 0, 'and without reject');
	});
	// check for no body exception EXCEPTIONS.EMPTY_MAIL_BODY; 
	t.test('Don\'t send empty mail', async t => {
		let mailer = await getMailer(config, FAKELOGGER);
		t.rejects(mailer({
			to: 'recipient@example.com',
			from: 'sender@example.com',
			subject: 'Test'
		}), EXCEPTIONS.EMPTY_MAIL_BODY, ' if body is missing');
	});
});