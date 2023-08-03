import { test } from 'tap'
import { initApp } from '../../src/app.js'
// import Fixtures from 'node-mongodb-fixtures';

test('Basic browse', async t => {
  let app;
  t.before(async () => {
    app = await initApp();
    await app.ready()
    app.log.info('Ready to test !!!!')
  })
  t.teardown(async () => {
    app.close();
  });
	t.test('requests the "/" route', async (t) => {
    // fixtures.connect(app.mongo.db);
    // await fixtures.load()
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/'
      })
      t.equal(response.statusCode, 200, 'returns a status code of 200');
      t.end();
    } catch(e) {
      t.fail(e)
    }
    // fixtures.disconnect();
  })
  
})