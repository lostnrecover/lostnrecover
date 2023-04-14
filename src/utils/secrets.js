// const sodium = require('sodium-native')
// const buf = Buffer.allocUnsafe(sodium.crypto_secretbox_KEYBYTES)
// sodium.randombytes_buf(buf)
// process.stdout.write(buf)

// https://github.com/fastify/fastify-secure-session/blob/master/genkey.js
import sodium from 'sodium-native';
import fs from 'fs/promises';

export async function writeSecretFile(filename) {
	const buf = Buffer.allocUnsafe(sodium.crypto_secretbox_KEYBYTES);
	sodium.randombytes_buf(buf);
	await fs.writeFile(filename, buf);
	return buf;
}
// const cookie_secret_file = process.env.COOKIE_SECRET_FILE || path.join(__dirname, '../.session-secret-key')
export async function getSecret(filename) {
	let secret = false;
	try {
		secret = await fs.readFile(filename);
	} catch(e) {
		secret = await writeSecretFile(filename);
	}
	return secret;
} 