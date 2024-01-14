import { nanoid } from 'nanoid';
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
	// t.test('requests the "/support"', async (t) => {
	//   try {
	//     const response = await app.inject({
	//       method: 'GET',
	//       url: '/support'
	//     })
	//     t.equal(response.statusCode, 200, 'returns a status code of 200');
	//   } catch(error) {
	//     t.fail('Unexpected Exception', err)
	//   }
	//   return true;
	// });
	t.test('Send support request', async (t) => {
		const rvalue = nanoid(), queryString = new URLSearchParams({
				email: 'test@example.com',
				subject: 'test',
				reason: 'Questions',
				message: rvalue
			}),
			response = await app.inject({
				method: 'POST',
				url: '/support',
				payload: queryString.toString(),
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
			});
		t.equal(response.statusCode, 302, 'returns a status code of 302');
		let msg = (await app.services.MSG.list())[0];
		t.equal(msg.status, 'new', 'Message is ready to be sent');
		t.equal(msg.from, 'test@example.com', 'from test email');
		t.equal(msg.subject, 'Questions - test', 'with subject');
		t.match(msg.context.message, rvalue, 'with body' );
		t.equal(response.headers['location'], '/', 'and redirect');
		// TODO check flash message success
	});
  
});