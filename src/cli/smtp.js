import { initCli } from './cli-base.js';
import { getMailer } from '../utils/mail.js';
import { nanoid } from 'nanoid';

let cli = await initCli();
let args = process.argv.slice(2),
	email = args[0];
	// state = ((args[0] ?? 'set') == 'set') ? true : false;

// cli.logger.info(args);
if(!email) {
	cli.logger.error('Missing argument user email address');
	await cli.close(99);
}
try {
	// Check SMTP connection
	let mailer = await getMailer(cli.config, cli.logger),
		testid = nanoid(),
		res = await mailer({
			text: `Test email ${testid}`,
			subject: `Test email ${testid}`,
			to: email
		});
	// Send test email
	cli.logger.info(`Test email sent ${testid}`);
	cli.logger.debug(res);
} catch (e) {
	cli.logger.error(e);
} finally {
	await cli.close();
}