import {UserService} from '../services/user.js'
import { AuthTokenService } from '../services/authtoken.js'
import { MessageService } from '../services/messages.js';
import { EXCEPTIONS } from '../services/exceptions.js';
// import fastifySecureSession from '@fastify/secure-session';

function invalidEmail(email) {
	const INVALID = true, OK = false;
	if(!email) {
		return INVALID;
	}
	if (email.lastIndexOf('@') < email.length) {
		return OK;
	}
	return INVALID;
}

// src/routes/accounts.js
export default async function(fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'AccountAPI' }),
		USERS = await UserService(fastify.mongo.db, logger, fastify.config),
		MSG = await MessageService(fastify.mongo.db, logger, fastify.config),
		{ create, verify} = await AuthTokenService(fastify.mongo.db, logger, fastify.config);

	fastify.get('/login', async (request, reply) => {
		reply.view('magicLink/form', { title: 'Login', url: request.query.redirect })
		return reply
	})
	fastify.post('/login', async (request, reply) => {
		let email = request.body.email,
			redirect = "";
		if(request.body.redirect) {
			redirect = `&redirect=${request.body.redirect}`;
		}
		if (invalidEmail(email)) {
			request.flash('error', 'Invalid email address');
			reply.redirect(`/login?${redirect}`);
			return reply;
		} else {
			// Check user email or create user if not exists
			let user = await USERS.findOrCreate(email, 'signin'), tokenLogger = logger.child({user})
			if(user.status == 'blocked') {
				request.flash('error', `Account ${email} is locked, please contact support: ${fastify.config.support_email}`);
				reply.redirect(`/login?${redirect}`);
				return reply;
			}
			const token = await create(user.email);
			let link = `${request.protocol}://${request.hostname}/auth?token=${token}${redirect}`;
			// Send email
			MSG.create({
				to: email,
				subject: 'Please verify your email',
				template: 'mail/email_verify',
				context: { link, token, email },
			});
			tokenLogger.child({token, link, email}).info('Magic Link');
			if(process.env.ENV == 'dev') {
				request.flash('warning', `Auto logged in as  ${email}`);
				reply.redirect(link);
				return reply
			}
		}
		reply.redirect(`/auth?email=${email}${redirect}`);
		return reply;
	})
	fastify.get('/auth',{
		schema: {
			// request needs to have a querystring with a `name` parameter
				querystring: { 
					token: { type: 'string'} 
					//, redirect: { type: 'string'}, email: { type: 'string'} 
				}
			}
		}, async (request, response) => {
			let data = {};
			if(request.query.email) {
				data.email = request.query.email
			}
			if(request.query.redirect) {
				data.redirect = request.query.redirect
			}
			if(request.query.token) {
				// check provided token
				try {
					let user = await USERS.login(request.query.token);
					if(!user) {
						throw('Invalid Token');
					} 
					// init session
					request.session.set('email', user.email);
					request.session.set('user_id', user._id );
					request.session.set('isAdmin', !!user.isAdmin);
					if(request.query.redirect) {
						response.redirect(request.query.redirect);
					} else {
						response.redirect(`/`)
					}
				} catch(e) {
					if(e=='Invalid Token') {
						request.flash('warning', `Invalid token`);
						data.title = 'Magiclink instructions';
						response.code(401);
						response.view('magicLink/instructions', data);
					} else {
						throw(e);
					}
				}
			} else {
				// Propose to help
				data.title = 'Magiclink instructions'
				response.view('magicLink/instructions', data);
			}
			return response
	})
	fastify.get('/logout', (req, res) => {
		// kill session
		req.session.delete()
		//return ok
		if(req.query.redirect) {
			res.redirect(req.query.redirect);
		} else {
			res.redirect(`/`)
		}
	});
	done();
}
