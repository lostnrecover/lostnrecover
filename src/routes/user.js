import {UserService} from '../services/user.js'
import { AuthTokenService } from '../services/authtoken.js'
import tz from 'timezones-list';
// import fastifySecureSession from '@fastify/secure-session';

// src/routes/accounts.js
export default function(fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'User' }),
		USERS = UserService(fastify.mongo.db, logger),
		{ authenticated } = AuthTokenService(fastify.mongo.db, logger);

	fastify.route({
		method: ['GET', 'POST'],
		preHandler: authenticated,
		handler: async (request, reply) => {
			let user = await USERS.findOrCreate(request.session.email);
			if(request.body) {
				user.tz = request.body.timezone;
				user.locale = request.body.locale;
				// Update user profile
				user = 	await USERS.update(user._id, user);
			}
			if(!user.tz) {
				user.tz = 'Europe/Paris';
			}
			reply.view('account',  { user, timezones: tz.default.sort((a,b) => {
				return a.label > b.label
			})});
			return reply
		}
	})
	done();
}
