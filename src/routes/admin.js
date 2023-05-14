import { UserService } from "../services/user.js";
import { MessageService } from "../services/messages.js";
import { EXCEPTIONS, throwWithData } from '../services/exceptions.js';
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
  });
	fastify.post('/messages', {
		preHandler: AUTH.isAdmin
	}, async (request, reply) => {
		let list = request.body.selected, action = request.body.action;
		if(typeof list == "string") {
			list = [ list ];
		}
		if(action == 'resend') {
			for (const i in list) {
				if (Object.hasOwnProperty.call(list, i)) {
					const msgid = list[i];
					let res = await MSG.send(msgid);
					if(res) {
						logger.debug({msgid, res}, "Message resent");
					} else {
						logger.error({msgid}, 'Resend messages failed');
					}
				}
			}
			reply.redirect(request.url);
		} else {
			throwWithData(EXCEPTIONS.BAD_REQUEST, {'hint': 'Invalid Action'})
		}
		return reply;
	})
  done()
}
