import { UserService } from "../services/user.js";
import { MessageService } from "../services/messages.js";
import { EXCEPTIONS } from '../services/exceptions.js'

export default function(fastify, opts, done) {
  function isAdmin(request) {
    if (process.env.ENV != 'dev' && !req.session.admin) {
      throw EXCEPTIONS.NOT_FOUND;
    }
  }

  // console.log('Init templates', opts.templateDir)
  fastify.get('/admin', async (req,reply) => {
	  const Users = UserService(fastify.mongo.db, fastify.log);
    reply.view('admin/index', {
      users: await Users.list()
    })
    return reply;
  });

  fastify.get('/admin/messages', async (request, reply) => {
    const Messages = MessageService(fastify.mongo.db, fastify.log);
    reply.view('admin/messages', {
      messages: await Messages.list()
    });
    return reply
  })

  // TODO: POST to (re)send error messages in admin

  done()
}
