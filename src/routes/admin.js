import { UserService } from "../services/user.js";
import { MessageService } from "../services/messages.js";
import { EXCEPTIONS } from '../services/exceptions.js';
import { AuthTokenService } from '../services/authtoken.js';
import { StatusService } from "../services/status.js";


export default async function(fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'Admin' }),
		AUTH = await AuthTokenService(fastify.mongo.db, logger, fastify.config),
		MSG = await MessageService(fastify.mongo.db, logger, fastify.config),
		USERS = await UserService(fastify.mongo.db, logger, fastify.config),
		STATUS = await StatusService(fastify.mongo.db, logger, fastify.config);

  fastify.get('/', {
		preHandler: AUTH.isAdmin
	}, async (req,reply) => {
    reply.view('admin/index', {
      users: await USERS.list(),
			title: 'Admninistration'
    })
    return reply;
  });

	fastify.get('/status', async (request, reply) => {
		return await STATUS.check("API");
	})

  fastify.get('/messages', {
		preHandler: AUTH.isAdmin
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
