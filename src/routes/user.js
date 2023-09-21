import tz from 'timezones-list';
import { EXCEPTIONS } from '../services/exceptions.js';

// src/routes/accounts.js
export default async function(fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'User' }),
		services = fastify.services;

	fastify.get('/', { preHandler: fastify.authenticated },
		async (request, reply) => {
			let user = await services.USERS.findOrFail(request.serverSession.user.email), NewAuth;
			if(!user.tz) {
				user.tz = 'Europe/Paris';
			}
			if(user.tokens[0]) {
				NewAuth = {}
				NewAuth.URL = `https://${fastify.config.DOMAIN}/auth?token=${user.tokens[0]._id}`;
				NewAuth.QR = await services.QR.getQRCodeForLogin(user.tokens[0]._id);
			}
			reply.view('account',  {
				title: 'Account preferences',
				user,
				NewAuth,
				timezones: tz.default.sort((a,b) => {
					return a.label > b.label
				})
			});
			return reply
		}
	);

	fastify.post('/', { preHandler: fastify.authenticated },
		async (request, reply) => {
			let user = await services.USERS.findOrFail(request.serverSession.user.email);
			// if(!user) {
			// 	throw EXCEPTIONS.NOT_AUTHORISED;
			// }
			user.displayName = request.body.displayName;
			user.tz = request.body.timezone;
			user.locale = request.body.locale;
			// Update user profile
			user = 	await services.USERS.update(user._id, user);
			reply.redirect(request.url);
			return reply;
	});

	fastify.post('/session', { preHandler: fastify.authenticated },
		async (request, reply) => {
			// create a auth token
			let session = await services.AUTH.getSession(request), token = await services.AUTH.createAuth(request.serverSession.user.email),
			// gen QR code
				url =  `${request.protocol}://${request.hostname}/auth?token=${token}`;

			// redirect to listing
			reply.redirect('/account/');
			return reply;
		}
	);
	
	fastify.post('/session/:id/kill', { preHandler: fastify.authenticated },
		async (request, reply) => {
			let user = await services.USERS.findOrFail(request.serverSession.user.email), 
					sessionIdToDelete = request.params.id,
					session = await services.AUTH.getSession(request);
			if(!user) {
				throw(EXCEPTIONS.ACTION_NOT_AUTHORISED);
			}
			user.sessions.forEach((sess) => {
				if(sess._id == sessionIdToDelete && sess.email == session.email) {
					services.AUTH.deleteSession(sessionIdToDelete, session.email);
				}
			});
			reply.redirect('/account');
			return reply;
		}
	);
	done();
}
