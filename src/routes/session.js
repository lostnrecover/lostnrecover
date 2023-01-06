import {UserService} from '../services/user.js'
import { AuthTokenService } from '../services/authtoken.js'
// import fastifySecureSession from '@fastify/secure-session';

// src/routes/accounts.js
export default function(fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'AccountAPI' }),
		USERS = UserService(fastify.mongo.db, logger),
		{ create, verify} = AuthTokenService(fastify.mongo.db, logger);

	fastify.get('/login', async (req, reply) => {
		reply.view('magicLink/form')
		return reply
	})
	fastify.post('/login', async (req, res) => {
		let email = req.body.email,
			redirect = "";
		if(req.body.redirect) {
			redirect = `&redirect=${req.body.redirect}`;
		}
		if (!email) {
			res.code(404)
		} else {
			// Check user email or create user if not exists
			let user = await USERS.findOrCreate(email);
			let child = logger.child({user})
			/* with JWT
			// Generate token
			let d = new Date();
			d.setHours(d.getHours() + 1);
			const token = fastify.jwt.sign({ email, expiration: d })
			*/
			const token = await create(user.email, 3600 / 2);
			let link = `${req.protocol}://${req.hostname}/auth?token=${token}${redirect}`;
			// Send email
			fastify.sendmail({
				to: email,
				subject: 'Please verify your email to unlock your account',
				template: 'mail/email_verify',
				context: { link, token, email }
			})
			child.child({link, email}).info('Magic Link')
		}
		res.redirect(`/auth?email=${email}${redirect}`);
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
				let email = await USERS.login(req.query.token);
				if(!email) {
					throw('Invalid Token')
				}
				// init session
				req.session.set('email', email);
				if(req.query.redirect) {
					res.redirect(req.query.redirect);
				} else {
					res.redirect(`/`)
				}
			} else {
				// Propose to help
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
