
export default function(fastify, opts, done) {
  // console.log('Init templates', opts.templateDir)
  fastify.get('/', async (req,reply) => {
    if(req.query.tagId) {
      reply.redirect(`/t/${req.query.tagId}`)
    } else {
      reply.view('home', {})
    }
    return reply
  });
  fastify.get('/about', (req,reply) => {
    reply.view('about', {})
  });
  done()
}
