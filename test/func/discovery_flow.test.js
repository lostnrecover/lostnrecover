import { test } from 'tap'
import { initApp } from '../../src/app.js'
// import Fixtures from 'node-mongodb-fixtures';

test('Discovery flow: ', async t => {
  let app;
  t.before(async () => {
    app = await initApp();
    await app.ready()
    app.log.info('Ready to test !!!!')
  })
  t.teardown(async () => {
    app.close();
  })
  // test data
  // Scenario
  t.test('finder scan lost tag', async (t) => {
    let response = await app.inject({
      method: 'GET',
      url: '/t/lost_tag_1'
    });
    t.equal(response.statusCode, 200, 'found');
    t.match(response.body, "You found tag Lost Tag 1 with id:  <strong><code>lost_tag_1</code></strong>", 'with message');
    t.end();
  });
  t.test('finder register');
  t.test('finder confirms account');
  t.test('owner is notified');
  t.test('finder receives instructions');
  t.test('finder returns item');
  t.test('owner receives the item');
  
})