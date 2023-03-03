import { UserService } from "../services/user.js";
import { MessageService } from "../services/messages.js";
import { EXCEPTIONS } from '../services/exceptions.js';
import { AuthTokenService } from '../services/authtoken.js';

export default function(fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'Admin' }),
		AUTH = AuthTokenService(fastify.mongo.db, logger, fastify.config),
		MSG = MessageService(fastify.mongo.db, logger, fastify.config, fastify.sendmail),
		USERS = UserService(fastify.mongo.db, logger, fastify.config);

  function isAdmin(request) {
    if (process.env.ENV != 'dev' && !req.session.admin) {
      throw EXCEPTIONS.NOT_FOUND;
    }
  }

  fastify.get('/', {
		preHandler: AUTH.authentified
	}, async (req,reply) => {
    reply.view('admin/index', {
      users: await USERS.list(),
			title: 'Admninistration'
    })
    return reply;
  });

  fastify.get('/messages', {
		preHandler: AUTH.authentified
	}, async (request, reply) => {
    reply.view('admin/messages', {
      messages: await MSG.list(),
			title: 'Messages administration'
    });
    return reply
  })
  // TODO: POST to (re)send error messages in admin
  done()
}
