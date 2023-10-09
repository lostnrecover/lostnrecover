import { test } from 'tap'
import { initApp } from '../../src/app.js'
import { sendMail } from '../helpers/mail.js';

test('Discovery flow: ', async t => {
  let app, finder_session_cookie, owner_session_cookie, authlink, discurl, msg;
  t.before(async () => {
    app = await initApp();
    await app.ready()
    app.log.info('Ready to test !!!!')
    // reset mesagess
    await app.mongo.db.collection('messages').deleteMany({});
    // get message service
    msg = app.services.MSG;
  });
  t.teardown(async () => {
    app.close();
  });

  // test data
  // Scenario
  // Finder scan the tag: Found and form to submit report
  t.test('finder scan lost tag', async (t) => {
    let response = await app.inject({
      method: 'GET',
      url: '/t/lost_tag_1'
    });
    t.equal(response.statusCode, 200, 'found');
    t.match(response.body, "You found tag Lost Tag 1 with id:  <strong><code>lost_tag_1</code></strong>", 'with message');
    t.match(response.body, "<form method=\"post\" action=\"/t/lost_tag_1/notify\"", 'with register form')
    t.end();
  });


  t.test('finder registers', async (t) => {
    let response = await app.inject({
      method: 'POST',
      url: '/t/lost_tag_1/notify',
      body: {
        email: 'finder@example.com'
      }
    }), redirect = response.headers['location']
    t.equal(response.statusCode, 302, 'with redirect')
    t.match(redirect, 'finder@example.com', 'include email')
    t.match(redirect, '/t/lost_tag_1/notify', 'to notify id')
  });


  t.test('finder receives a link by email to authenticate (and register)', async (t) => {
    let notification = await msg.list({
      template: 'mail/email_verify',
      to: 'finder@example.com',
      status: 'new'
    });
    t.equal(notification.length, 1, '1 notification email');
    notification = notification[0];
    let mail = await sendMail(notification, msg, t)
    // t.match(await notification.content.text(), '/t/lost_tag_1/notify', 'fetch');
    // Match text only url
    authlink = mail.match(/^http.*(\/auth\?token=.*)$/m);
    t.not(authlink, null, 'Find token pattern');
    authlink = authlink[1];
    t.match(authlink,'/auth?token=', 'Find auth link');
  });


  t.test('finder confirms account ', async (t) => {
    // and sees tag information and instructions
    // authlink="/auth?token=token-finder&redirect=/t/lost_tag_1/notify",
    let response = await app.inject({
        method: 'GET',
        url: authlink
      });
    t.equal(response.statusCode, 302, 'Auth ok and redirect ' + authlink)
    t.match(response.headers['location'], '/t/lost_tag_1/notify', 'redirect to tag notification')
    t.ok(response.cookies.length > 0, 'has a session cookie');
    finder_session_cookie = response.cookies.find(e => e.name == 'lnr').value;
    discurl = response.headers['location'];
    response = await app.inject({
      method: 'GET',
      url: discurl,
      cookies: { 'lnr': finder_session_cookie }
    });
    t.match(response.body, '<small>finder@example.com</small>', 'valid session');
  });


  t.test('owner is notified', async (t) => {
    let notification = await msg.list({
      template: 'mail/found',
      to: 'owner@example.com',
      status: 'new'
    }), mail = await sendMail(notification[0], msg, t);
    t.equal(notification.length, 1, '1 notification email');
    t.match(mail, '<h2>Tag Lost Tag 1 found</h2>')
  });


  t.test('finder receives instructions', async (t) => {
    let notification = await msg.list({
      template: 'mail/instructions',
      to: 'finder@example.com',
      status: 'new'
    }), mail = await sendMail(notification[0], msg, t);
    t.equal(notification.length, 1, '1 notification email');
    t.match(mail, 'instructions for finder');
  });

  t.test('finder can find its discovery in list', async (t) => {
    let response = await app.inject({
      method: 'GET',
      url: '/discoveries',
      cookies: { 'lnr': finder_session_cookie }
    }), rowscount = 0;
    t.equal(response.statusCode, 200, 'discoveries list ok');
    t.match(response.body, `<td><a href="${discurl}">lost_tag_1</a></td>`, 'Link to discovery');
    rowscount = ( response.body.match(/<tr>/g) || []).length - 1; // remove table header row
    t.equal(1, rowscount, 'Only 1 discovery for finder')
    t.match(response.body, '<td><span class="status  active">')
  })

  t.test('finder returns item', async (t) => {
    let response = await app.inject({
      method: 'GET',
      url: discurl,
      cookies: { 'lnr': finder_session_cookie }
    });
    t.equal(response.statusCode, 200, 'Discovery visible')
    t.match(response.body,'<button type="submit" value="return" name="action">I have returned this item</button>', 'includes a return button' );
    response = await app.inject({
      method: 'POST',
      url: discurl,
      cookies: { 'lnr': finder_session_cookie },
      payload: {
        action: 'return'
      }
    });
    t.equal(response.statusCode, 302, 'action confirmed and redirect')
    t.equal(response.headers['location'], discurl, 'redirect ot current page');
  });


  t.test('owner receives the item', async (t)=>{

    // login as an owner
    let response = await app.inject({
      method: 'GET',
      url: '/auth?token=token-owner'
    });
    t.equal(response.statusCode, 302, 'Token approved')
    owner_session_cookie = response.cookies.find(e => e.name == 'lnr').value;
    // flag the tag returned
    response = await app.inject({
      method: 'GET',
      url: discurl,
      cookies: { lnr: owner_session_cookie }
    });
    t.equal(response.statusCode, 200, 'can view the discovery ');
    t.match(response.body, '<button type="submit" value="close" name="action">I have received this item</button>', 'with a returned button')
    // status
    response = await app.inject({
      method: 'POST',
      url: discurl,
      cookies: { lnr: owner_session_cookie },
      payload: {
        action: 'close'
      }
    });
    t.equal(response.statusCode, 302, 'action confirmed and redirect');
    t.equal(response.headers['location'], discurl, 'redirect to current page');
    
    response = await app.mongo.db.collection('discovery').findOne({
      _id: discurl.split('/').pop()
    });
    t.equal(response.status, 'recovered', 'discovery flow closed')
  });
});