
// current dir for options
import path from 'path'
import url from 'url';
import {ConnectionString} from 'connection-string';
import { getSecret } from './utils/secrets.js';

const smtpcs = new ConnectionString(process.env.SMTP_URL || "smtp://bradford5%40ethereal.email:jnTpmpbZsUSYuDwxp3@smtp.ethereal.email:587");
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export const config = {
	// TODO : config linked to domain
	appName: 'Lost n Recover',
	support_email: 'support@lostnrecover.me',
	DOMAIN: process.env.DOMAIN ?? 'dev.lostnrecover.me',
	SHORT_DOMAIN: process.env.SHORT_DOMAIN ?? 'dev.rtbk.me',
	PORT: process.env.PORT || 3000,
	HOST: process.env.HOST || '::',
	db_url: process.env.DB_URL || `mongodb://mongodb/lostnfound_${process.env.ENV}`,
	cookies: {
		name: 'lnr',
		secret: await getSecret(process.env.COOKIE_SECRET_FILE || path.join(__dirname, '../.session-secret-key')) //fs.readFileSync(cookie_secret_file)
	},
	locales: {'en': 'English', 'fr': 'Français'},
	cache_dir: path.join(__dirname, '/../tmp'),
	pdf_cache_dir: path.join(__dirname, '../public/pdf'),
	public_dir: path.join(__dirname, '/../public'),
	template_dir: process.env.TEMPLATE_DIR || path.join(__dirname, './templates'),
	mail_transport: {
		host: smtpcs.hostname,
		port: smtpcs.port,
		secure: smtpcs.params?.secure ? true : false,
    auth: {
			user: smtpcs.user,
			pass: smtpcs.password
		}
	},
}
