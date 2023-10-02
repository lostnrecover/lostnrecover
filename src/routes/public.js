
export default async function(fastify, opts, done) {
	const 
    logger = fastify.log.child({ controller: 'Client' }),
    services = fastify.services,
    reasons = [
      { value: 'Bug', name: 'Bug Report' },
      { value: 'Questions', name: 'Questions' },
      { value: 'Personal Data', name: 'Personal Data' }
    ];

  fastify.get('/', async (request,reply) => {
    if(request.query.tagId) {
      reply.redirect(`/t/${request.query.tagId}`)
    } else {
      reply.view('home')
    }
    return reply
  });
  fastify.get('/about', (request,reply) => {
    reply.view('about')
  });
  fastify.get('/about/privacy', (request,reply) => {
    reply.view('privacy')
  });
  async function getSupportForm(request, reply, data) {
    reply.view('contact_form', {...data, reasons});
    return reply
  }
  fastify.get('/support', async (request,reply) => {
    return getSupportForm(request, reply)
  });
  fastify.post('/support', async (request,reply) => {
    let { email, message, subject, reason } = request.body
    if(request.serverSession?.user?.email) {
      email = request.serverSession.user.email;
    }
    // basic sanity check
    if(!email || email.indexOf('@') < 1) {
      request.flash('error', 'Invalid email address');
      return getSupportForm(request, reply, { email, message, subject, reason });
    }
    if(!reason) {
      request.flash('error', 'Please provide a reason');
      return getSupportForm(request, reply, { email, message, subject, reason });
    }
    if(!subject && !message) {
      request.flash('error', 'Please provide more information about your request');
      return getSupportForm(request, reply, { email, message, subject, reason });
    }
    // Actually send the message: put it in the queue
    let id = await services.MSG.create({
      to: fastify.config.support_email,
      from: email,
      subject: `${reason} - ${subject}`,
      template: 'mail/contact_form',
      context: { email, message, subject, reason },
    });
    // TODO Redirect parameter
    request.flash('success', 'You message has been sent');
    reply.redirect('/');
    return reply;
  });
  done()
}
