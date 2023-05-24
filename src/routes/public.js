

export default function(fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'Client' });

  fastify.get('/', async (req,reply) => {
    if(req.query.tagId) {
      reply.redirect(`/t/${req.query.tagId}`)
    } else {
      reply.view('home', { title: 'Home' })
    }
    return reply
  });
  fastify.get('/about', (req,reply) => {
    reply.view('about', { title: 'About' })
  });
  fastify.get('/about/privacy', (req,reply) => {
    reply.view('privacy', { title: 'Privacy and Personnal data' })
  });
  done()
}
