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
			if(!user.tz) {
				user.tz = 'Europe/Paris';
			}
			reply.view('account',  { user, timezones: tz.default.sort((a,b) => {
				return a.name > b.name
			})});
			return reply
		}
	})
	done();
}
