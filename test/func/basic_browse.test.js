import { test } from 'tap';
import { initApp } from '../../src/app.js';
// import Fixtures from 'node-mongodb-fixtures';

test('Basic browse', async (t) => {
	let app;
	t.before(async () => {
		app = await initApp();
		await app.ready();
		app.log.info('Ready to test !!!!');
	});
	t.teardown(() => app.close());
	t.test('requests the "/"', async (t) => {
		try {
			const response = await app.inject({
				method: 'GET',
				url: '/'
			});
			t.equal(response.statusCode, 200, 'returns a status code of 200');
		} catch(error) {
			t.fail('Unexpected Exception', error);
		}
		return true;
	});
	t.test('requests the "/about"', async (t) => {
		try {
			const response = await app.inject({
				method: 'GET',
				url: '/about'
			});
			t.equal(response.statusCode, 200, 'returns a status code of 200');
		} catch(error) {
			t.fail('Unexpected Exception', error);
		}
		return true;
	});
	t.test('requests the "/about/privacy"', async (t) => {
		try {
			const response = await app.inject({
				method: 'GET',
				url: '/about/privacy'
			});
			t.equal(response.statusCode, 200, 'returns a status code of 200');
		} catch(error) {
			t.fail('Unexpected Exception', error);
		}
		return true;
	});  
});