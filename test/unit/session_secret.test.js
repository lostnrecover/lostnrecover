import { test } from 'tap'
import { getSecret } from '../../src/utils/secrets.js';
import { access, constants, rm} from 'fs/promises'
// import Fixtures from 'node-mongodb-fixtures';


test('Secret Management', async (t) => {
	const missingFile = './test/data/missing.txt',
		actualSecret = './test/data/secret.txt';

	t.beforeEach(async () => {
		return rm(missingFile, { force: true });
	})
	
	t.afterEach(async () => {
		return rm(missingFile, { force: true });
	})

	t.test('read secret from file', async t => {
		let expected = Buffer.from('secret text');
		// t.ok(expected.compares(await getSecret(actualSecret)), 'Should read secret text in file')
		t.equal((await getSecret('./test/data/secret.txt')).toString('hex'), expected.toString('hex'), 'Should read secret text in file')
	})
	
	t.test('create a new secret if not exists', async t => {
		let secret = await getSecret(missingFile);
		// a secret is found
		t.ok(secret.length, 32);
		// a secret file exists
		try {
			let a = await access(missingFile, constants.R_OK)
			t.pass('File exists');
		} catch(e) {
			t.fail("File should exists after secret requested");
		}
	})
})
