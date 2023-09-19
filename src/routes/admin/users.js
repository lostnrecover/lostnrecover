import { UserService } from "../../services/user.js";
import { AuthTokenService } from '../../services/authtoken.js';
import { MessageService } from '../../services/messages.js';
import { EXCEPTIONS } from "../../services/exceptions.js";

export default async function(fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'AdminUser' }),
		AUTH = await AuthTokenService(fastify.mongo.db, logger, fastify.config),
		MSG = await MessageService(fastify.mongo.db, logger, fastify.config),
		USERS = await UserService(fastify.mongo.db, logger, fastify.config);

  fastify.get('/', {
		preHandler: AUTH.isAdmin
	}, async (req,reply) => {
    reply.view('admin/users', {
      users: await USERS.list(),
			title: 'Admin - Users'
    })
    return reply;
  });

	async function resendToken(user_id, url) {
		let user = await USERS.findById(user_id);
		if(user) {
			const token = await AUTH.createAuth(user.email);
			let link = `${url}?token=${token}`;
			// Send email
			MSG.create({
				to: user.email,
				subject: 'Please verify your email',
				template: 'mail/email_verify',
				context: { link, token, email: user.email },
			});
		} else {
			throw EXCEPTIONS.NOT_FOUND;
		}
	}

	async function changeUserStatus(user_id, status) {
		let user = await USERS.findById(user_id);
		if(user) {
			USERS.update(user_id, { status: status })
		} else {
			throw EXCEPTIONS.NOT_FOUND;
		}
	}

	async function killAllSessions(user_id) {
		let user = await USERS.findById(user_id);
		if(user.sessions && user.sessions.length > 0) {
			return Promise.all(user.sessions.map(session => {
				return AUTH.deleteSession(session._id, user.email);
			}));
		}
	}

	fastify.post('/', {
		preHandler: AUTH.isAdmin
	}, async (request,reply) => {
		if(request.body.action == 'token') {
			await resendToken(request.body.user_id, `${request.protocol}://${request.hostname}/auth`);
		} else if(request.body.action == 'block') {
			await changeUserStatus(request.body.user_id, 'blocked');
			await killAllSessions(request.body.user_id);
		}	else if(request.body.action == 'activate') {
			await changeUserStatus(request.body.user_id, 'active');
		} else if(request.body.action == 'kill') {
			await killAllSessions(request.body.user_id);
		}
		reply.redirect(request.url);
		return reply;
	})

}