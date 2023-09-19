import {UserService} from '../services/user.js'
import { AuthTokenService } from '../services/authtoken.js'
import tz from 'timezones-list';
import { EXCEPTIONS } from '../services/exceptions.js';
import QRCode from 'qrcode';
// import fastifySecureSession from '@fastify/secure-session';

// src/routes/accounts.js
export default async function(fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'User' }),
		USERS = await UserService(fastify.mongo.db, logger, fastify.config),
		{ authenticated, deleteSession, getSession, createAuth } = await AuthTokenService(fastify.mongo.db, logger, fastify.config);

	fastify.get('/', { preHandler: authenticated },
		async (request, reply) => {
			let user = await USERS.findOrFail(request.serverSession.user.email), NewAuth;
			if(!user.tz) {
				user.tz = 'Europe/Paris';
			}
			if(user.tokens[0]) {
				NewAuth = {}
				NewAuth.URL = `${request.protocol}://${request.hostname}/auth?token=${user.tokens[0]._id}`
				NewAuth.QR = await QRCode.toDataURL(`${request.protocol}://${request.hostname}/auth?token=${user.tokens[0]._id}`);
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

	fastify.post('/', { preHandler: authenticated },
		async (request, reply) => {
			let user = await USERS.findOrFail(request.serverSession.user.email);
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

	fastify.post('/session', { preHandler: authenticated },
		async (request, reply) => {
			// create a auth token
			let session = await getSession(request), token = await createAuth(request.serverSession.user.email),
			// gen QR code
				url =  `${request.protocol}://${request.hostname}/auth?token=${token}`;

			// redirect to listing
			reply.redirect('/account/');
			return reply;
		}
	);
	
	fastify.post('/session/:id/kill', { preHandler: authenticated },
		async (request, reply) => {
			let user = await USERS.findOrFail(request.serverSession.user.email), 
					sessionIdToDelete = request.params.id,
					session = await getSession(request);
			if(!user) {
				throw(EXCEPTIONS.ACTION_NOT_AUTHORISED);
			}
			user.sessions.forEach((sess) => {
				if(sess._id == sessionIdToDelete && sess.email == session.email) {
					deleteSession(sessionIdToDelete, session.email);
				}
			});
			reply.redirect('/account');
			return reply;
		}
	);
	done();
}
