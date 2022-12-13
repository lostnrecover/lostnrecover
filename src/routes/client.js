
export default function(fastify, opts, done) {
  // console.log('Init templates', opts.templateDir)
  fastify.get('/', (req,reply) => {
    reply.view('home', {})
  });
  fastify.get('/create', (req, reply) => {
    reply.view('newTagForm')
  })
  done()
}
