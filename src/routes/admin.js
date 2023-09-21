import { EXCEPTIONS, throwWithData } from '../services/exceptions.js';

export default async function(fastify, opts, done) {
	const 
		logger = fastify.log.child({ controller: 'Admin' }),
		services = fastify.services;


  fastify.get('/', {
		preHandler: fastify.isAdmin
	}, async (req,reply) => {
    reply.view('admin/index', {
      users: await services.USERS.list(),
			title: 'Admninistration'
    })
    return reply;
  });

	fastify.get('/status', async (request, reply) => {
		return await services.STATUS.check("API");
	})

	fastify.get('/config', {
		preHandler: fastify.isAdmin
	}, async (request, reply) => {
		reply.view('admin/config');
		return reply;
	})

  fastify.get('/messages', {
		preHandler: fastify.isAdmin
	}, async (request, reply) => {
    reply.view('admin/messages', {
      messages: await services.MSG.list(),
			title: 'Messages administration'
    });
    return reply
  });
	fastify.post('/messages', {
		preHandler: fastify.isAdmin
	}, async (request, reply) => {
		let list = request.body.selected, action = request.body.action;
		if(typeof list == "string") {
			list = [ list ];
		}
		if(action == 'resend') {
			for (const i in list) {
				if (Object.hasOwnProperty.call(list, i)) {
					const msgid = list[i];
					let res = await services.MSG.send(msgid);
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
