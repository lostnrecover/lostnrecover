import {UserService} from '../services/user.js'
import { AuthTokenService } from '../services/authtoken.js'
// import fastifySecureSession from '@fastify/secure-session';

function invalidEmail(email) {
	return !email
}

// src/routes/accounts.js
export default function(fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'AccountAPI' }),
		USERS = UserService(fastify.mongo.db, logger),
		{ create, verify} = AuthTokenService(fastify.mongo.db, logger);

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
			request.flash('error_msg', 'Invalid email address');
			reply.redirect(`/login?${redirect}`);
			return reply;
		} else {
			// Check user email or create user if not exists
			let user = await USERS.findOrCreate(email, 'signin');
			let child = logger.child({user})
			/* with JWT
			// Generate token
			let d = new Date();
			d.setHours(d.getHours() + 1);
			const token = fastify.jwt.sign({ email, expiration: d })
			*/
			const token = await create(user.email, 3600 / 2);
			let link = `${request.protocol}://${request.hostname}/auth?token=${token}${redirect}`;
			// TODO background send >?
			// Send email
			fastify.sendmail({
				to: email,
				subject: 'Please verify your email to unlock your account',
				template: 'mail/email_verify',
				context: { link, token, email }
			})
			child.child({token, link, email}).info('Magic Link');
			if(process.env.ENV == 'dev') {
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
				querystring: { token: { type: 'string'} }
			}
		}, async (req, res) => {
			let data = {};
			if(req.query.email) {
				data.email = req.query.email
			}
			if(req.query.redirect) {
				data.redirect = req.query.redirect
			}
			if(req.query.token) {
				// check provided token
				let user = await USERS.login(req.query.token);
				if(!user) {
					throw('Invalid Token')
				}
				// init session
				req.session.set('email', user.email);
				req.session.set('user_id', user._id )
				if(req.query.redirect) {
					res.redirect(req.query.redirect);
				} else {
					res.redirect(`/`)
				}
			} else {
				// Propose to help
				data.title = 'Magiclink instructions'
				res.view('magicLink/instructions', data);
			}
			return res
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
