import { EXCEPTIONS } from '../services/exceptions.js';

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
	const 
		logger = fastify.log.child({ controller: 'AccountAPI' }),
		services = fastify.services;

	fastify.get('/login', async (request, reply) => {
		reply.view('magicLink/form', { url: request.query.redirect });
		return reply;
	});
	fastify.post('/login', async (request, reply) => {
		let email = request.body.email,
			redirect = '';
		if(request.body.redirect) {
			redirect = `&redirect=${request.body.redirect}`;
		}
		if (invalidEmail(email)) {
			request.flash('error', 'Invalid email address');
			reply.redirect(`/login?${redirect}`);
			return reply;
		} else {
			// Check user email or create user if not exists
			let user = await services.USERS.findOrCreate(email, 'signin'), tokenLogger = logger.child({user});
			if(user.status == 'blocked') {
				request.flash('error', `Account ${email} is locked, please contact support: ${fastify.config.support_email}`);
				reply.redirect(`/login?${redirect}`);
				return reply;
			}
			const token = await services.AUTH.createAuth(user.email);
			let link = `${request.protocol}://${request.hostname}/auth?token=${token}${redirect}`;
			// Send email
			services.MSG.create({
				to: email,
				subject: 'Please verify your email',
				template: 'mail/email_verify',
				context: { link, token, email },
			});
			tokenLogger.child({token, link, email}).info('Magic Link');
			if(process.env.ENV == 'dev') {
				request.flash('warning', `Auto logged in as  ${email}`);
				reply.redirect(link);
				return reply;
			}
		}
		reply.redirect(`/auth?email=${email}${redirect}`);
		return reply;
	});
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
			data.email = request.query.email;
		}
		if(request.query.redirect) {
			data.redirect = request.query.redirect;
		}
		if(request.query.token) {
			// check provided token
			try {
				let user = await services.USERS.login(request.query.token);
				if(!user) {
					throw('Invalid Token');
				} 
				await services.AUTH.createSession(user, request);
				if(request.query.redirect) {
					response.redirect(request.query.redirect);
				} else {
					response.redirect('/');
				}
			} catch(e) {
				if(e=='Invalid Token') {
					request.flash('warning', 'Invalid token');
					// response.code(401);
					// response.view('magicLink/instructions', data);
					throw(EXCEPTIONS.BAD_TOKEN);
				} else {
					throw(e);
				}
			}
		} else {
			// Propose to help
			response.view('magicLink/instructions', data);
		}
		return response;
	});
	fastify.get('/logout',  {
		preHandler: fastify.authentified
	}, async (request, reply) => {
		// kill session
		services.AUTH.deleteCurrentSession(request);
		//return ok
		if(request.query.redirect) {
			reply.redirect(request.query.redirect);
		} else {
			reply.redirect('/');
		}
		return reply;
	});
	logger.debug('SessionsRoute loaded');
	done();
}
