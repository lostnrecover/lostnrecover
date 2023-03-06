import {UserService} from '../services/user.js'
import { AuthTokenService } from '../services/authtoken.js'
import tz from 'timezones-list';
import { EXCEPTIONS } from '../services/exceptions.js';
// import fastifySecureSession from '@fastify/secure-session';

// src/routes/accounts.js
export default async function(fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'User' }),
		USERS = await UserService(fastify.mongo.db, logger),
		{ authenticated } = await AuthTokenService(fastify.mongo.db, logger);

	fastify.get('/', { preHandler: authenticated },
		async (request, reply) => {
			let user = await USERS.findOrFail(request.session.email);
			if(!user.tz) {
				user.tz = 'Europe/Paris';
			}
			reply.view('account',  {
				title: 'Account preferences',
				user,
				timezones: tz.default.sort((a,b) => {
					return a.label > b.label
				})
			});
			return reply
		}
	);
	fastify.post('/', { preHandler: authenticated },
		async (request, reply) => {
			let user = await USERS.findOrFail(request.session.email);
			// if(!user) {
			// 	throw EXCEPTIONS.NOT_AUTHORISED;
			// }
			user.displayName = request.body.displayName;
			user.tz = request.body.timezone;
			user.locale = request.body.locale;
			// Update user profile
			user = 	await USERS.update(user._id, user);
			reply.redirect(request.url);
			return reply;
	});
	done();
}
