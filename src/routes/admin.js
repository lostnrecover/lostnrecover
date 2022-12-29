import { UserService } from "../services/user.js";

export default function(fastify, opts, done) {

  // console.log('Init templates', opts.templateDir)
  fastify.get('/admin', async (req,reply) => {
	  const Users = UserService(fastify.mongo.db, fastify.log);
    reply.view('admin/index', {
      users: await Users.list()
    })
    return reply;
  });

  done()
}
