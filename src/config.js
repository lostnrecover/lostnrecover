
// current dir for options
import path from 'path';
import url from 'url';
import {ConnectionString} from 'connection-string';
import { getSecret } from './utils/secrets.js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import os from 'os';

dotenv.config();

const pkg = JSON.parse(readFileSync('./package.json')) ?? {};

const appName = process.env.APP_NAME || pkg.displayName;

const smtpcs = new ConnectionString(process.env.SMTP_URL || 'smtp://localhost:587');
const imapcs = new ConnectionString(process.env.IMAP_URL || 'imap://localhost:993?secure=true');
const appId = `${os.hostname()}/${pkg.name}-${pkg.version}`;
const dbcs = new ConnectionString(process.env.DB_URL || `mongodb://mongodb/lostnfound_${process.env.ENV}`);
dbcs.setDefaults({
	params: {
		appname: `${appId}`
	}
});
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const DOMAIN = process.env.DOMAIN ?? 'dev.lostnrecover.me';
const SHORT_DOMAIN = process.env.SHORT_DOMAIN ?? 'dev.rtbk.me';

export const config = {
	// TODO : config linked to domain
	appName,
	appId,
	pkg,
	DOMAIN,
	SHORT_DOMAIN,
	support_email: `support@${DOMAIN}`,
	tag_email: `tag+{ID}@${DOMAIN}`,
	PORT: process.env.PORT || 3000,
	HOST: process.env.HOST || '::',
	db_url: dbcs.toString(),
	cookies: {
		name: 'lnr',
		secret: await getSecret(process.env.COOKIE_SECRET_FILE || path.join(__dirname, '../.session-secret-key')) //fs.readFileSync(cookie_secret_file)
	},
	locales: {'en': 'English', 'fr': 'Français'},
	log_dir: path.join(__dirname, '/../logs'),
	cache_dir: path.join(__dirname, '/../tmp'),
	pdf_cache_dir: path.join(__dirname, '../public/pdf'),
	public_dir: path.join(__dirname, '/../public'),
	data_dir: path.join(__dirname, '/../data'),
	template_dir: process.env.TEMPLATE_DIR || path.join(__dirname, './templates'),
	mail_connection_string: smtpcs,
	mail_transport: {
		host: smtpcs.hostname,
		port: smtpcs.port,
		secure: smtpcs.params?.secure ? true : false,
		auth: {
			user: smtpcs.user,
			pass: smtpcs.password
		},
		from: smtpcs.params?.from ?? smtpcs.user
	},
	imap: {
		host: imapcs.hostname,
		port: imapcs.port,
		tls: imapcs.params?.secure ? true : false,
		user: imapcs.user,
		password: imapcs.password,
		auth: {
			user: imapcs.user,
			pass: imapcs.password
		}
	}
};
