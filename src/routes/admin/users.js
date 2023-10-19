import { EXCEPTIONS } from '../../services/exceptions.js';

export default async function (fastify, opts, done) {
	const
		logger = fastify.log.child({ controller: 'AdminUser' }),
		services = fastify.services;

	fastify.get('/', {
		preHandler: fastify.isAdmin
	}, async (request, reply) => {
		reply.view('admin/users', {
			users: await services.USERS.list()
		});
		return reply;
	});

	async function resendToken(user_id, url) {
		let user = await services.USERS.findById(user_id);
		if (user) {
			const token = await services.AUTH.createAuth(user.email);
			let link = `${url}?token=${token}`;
			// Send email
			services.MSG.create({
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
		let user = await services.USERS.findById(user_id);
		if (user) {
			services.USERS.update(user_id, { status: status });
		} else {
			throw EXCEPTIONS.NOT_FOUND;
		}
	}

	async function killAllSessions(user_id) {
		let user = await services.USERS.findById(user_id);
		if (user.sessions && user.sessions.length > 0) {
			return Promise.all(user.sessions.map(session => {
				return services.AUTH.deleteSession(session._id, user.email);
			}));
		}
	}

	fastify.post('/', {
		preHandler: fastify.isAdmin
	}, async (request, reply) => {
		if (request.body.action == 'token') {
			await resendToken(request.body.user_id, `${request.protocol}://${request.hostname}/auth`);
		} else if (request.body.action == 'block') {
			await changeUserStatus(request.body.user_id, 'blocked');
			await killAllSessions(request.body.user_id);
		} else if (request.body.action == 'activate') {
			await changeUserStatus(request.body.user_id, 'active');
		} else if (request.body.action == 'kill') {
			await killAllSessions(request.body.user_id);
		}
		reply.redirect(request.url);
		return reply;
	});
	logger.debug('AdminUsersRoute loaded');
	done();
}