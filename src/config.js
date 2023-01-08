
// current dir for options
import path from 'path'
import url from 'url';
import fs from 'fs';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const cookie_secret_file = process.env.COOKIE_SECRET_FILE || path.join(__dirname, '../.session-secret-key')

export const config = {
	support_email: 'lnf@z720.net',
	appName: 'Lost n Found',
	DOMAIN: process.env.DOMAIN ?? null,
	SHORT_DOMAIN: process.env.SHORT_DOMAIN ?? null,
	PORT: process.env.PORT || 3000,
	HOST: process.env.HOST || '::',
	db_url: process.env.DB_URL || 'mongodb://mongodb/lostnfound',
	cookies: {
		name: 'lostnfound',
		secret: fs.readFileSync(cookie_secret_file)
	},
	locales: {'en': 'English', 'fr': 'Français'},
	app_root_dir: path.join(__dirname, '/..'),
	cache_dir: path.join(__dirname, '/../public/tmp'),
	pdf_cache_dir: path.join(__dirname, '../public/pdf'),
	public_dir: path.join(__dirname, '/../public'),
	template_dir: process.env.TEMPLATE_DIR || path.join(__dirname, './templates'),
		// TODO external mail configuration
	mail_transport: {
		host: 'smtp.ethereal.email',
		port: 587,
		auth: {
			user: 'elyssa.kessler60@ethereal.email',
			pass: 'gYRZ7cxFEEtEf1aKvU'
		}
		// transport: {
		//   host: 'smtp.example.tld',
		//   port: 465,
		//   secure: true, // use TLS
		//   auth: {
		//     user: 'john.doe',
		//     pass: 'super strong password'
		//   }
		// }
	},
}
