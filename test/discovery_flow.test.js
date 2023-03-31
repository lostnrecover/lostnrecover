import { test } from 'tap'
import { initApp } from '../src/app.js'
// import Fixtures from 'node-mongodb-fixtures';


test('requests the "/" route', async t => {
  const app = initApp();

  // fixtures.connect(app.mongo.db);
  // await fixtures.load()
  const response = await app.inject({
    method: 'GET',
    url: '/'
  })
  t.equal(response.statusCode, 200, 'returns a status code of 200');
  // fixtures.disconnect();
  app.close();
})