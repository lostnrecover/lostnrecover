import { test } from 'tap';
import { initApp } from '../../src/app.js';


test('Admin', async (t) => {
	let app, admin_session_cookie, user_session_cookie;
	const admin_urls = [
			'/admin',
			'/admin/user',
			'/admin/messages',
			'/admin/print/batch',
			'/admin/print/batch/advanced',
			'/admin/config'
		], status_url = '/admin/status';
	t.before(async () => {
		let response;
		app = await initApp();
		await app.ready();
		app.log.info('Ready to test !!!!');
		response = await app.inject({
			method: 'GET',
			url: '/auth?token=token-owner'
		});
		user_session_cookie = response.cookies.find(e => e.name == 'lnr').value;
		response = await app.inject({
			method: 'GET',
			url: '/auth?token=admin_user_session'
		});
		admin_session_cookie = response.cookies.find(e => e.name == 'lnr').value;
	});
	t.teardown(() => app.close());
	admin_urls.forEach(url => {
		t.test(`'requests the "${url}" not logged in'`, async (t) => {
			try {
				const response = await app.inject({
					method: 'GET',
					url
				});
				t.equal(response.statusCode, 401, 'returns an unauthorized error');
				// TODO with login form
				t.match(response.body, '<form action="/login" method="post">', 'with a login form');
			} catch (error) {
				t.fail('Unexpected Exception', error);
			}
		});
		t.test(`'request ${url} with simple user'`, async (t) => {
			try {
				const response = await app.inject({
					method: 'GET',
					url,
					cookies: { 'lnr': user_session_cookie }
				});
				t.equal(response.statusCode, 404, 'returns not found');
				t.match(response.body, 'Not Found', 'With an error page');
			} catch (error) {
				t.fail('Unexpected Exception', error);
			}
		});
		t.test(`'request ${url} with admin user'`, async (t) => {
			try {
				const response = await app.inject({
					method: 'GET',
					url,
					cookies: { 'lnr': admin_session_cookie }
				});
				t.equal(response.statusCode, 200, 'returns a success');
				// TODO and the admin menu
			} catch (error) {
				t.fail('Unexpected Exception', error);
			}
		});
	});
	t.test('Request /admin/status', async t => {
		t.test(' not logged in\'', async (t) => {
			try {
				const response = await app.inject({
					method: 'GET',
					url: status_url
				});
				let data = response.json();
				t.equal(response.statusCode, 200, 'returns a success');
				t.equal(data.reason, 'API', 'identied as API call');
			} catch (error) {
				t.fail('Unexpected Exception', error);
			}
		});
		t.test('with simple user\'', async (t) => {
			try {
				const response = await app.inject({
					method: 'GET',
					url: status_url,
					cookies: { 'lnr': user_session_cookie }
				});
				let data = response.json();
				t.equal(response.statusCode, 200, 'returns a success');
				t.equal(data.reason, 'API', 'identied as API call');
			} catch (error) {
				t.fail('Unexpected Exception', error);
			}
		});
		t.test('with admin user', async (t) => {
			try {
				const response = await app.inject({
					method: 'GET',
					url: status_url,
					cookies: { 'lnr': admin_session_cookie }
				});
				let data = response.json();
				t.equal(response.statusCode, 200, 'returns a success');
				t.equal(data.reason, 'API', 'identied as API call');
			} catch (error) {
				t.fail('Unexpected Exception', error);
			}
		});
	});
});