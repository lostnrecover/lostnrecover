import {UserService} from '../../services/user.js'
import { AuthTokenService } from '../../services/authtoken.js'
// import fastifySecureSession from '@fastify/secure-session';

// src/routes/v1/accounts.js
export default function(fastify, opts, done) {
	const SVC = UserService(fastify.mongo.db, fastify.log);
	const { create, verify} = AuthTokenService(fastify.mongo.db, fastify.log)
	fastify.get('/login', async (req, reply) => {
		reply.view('magicLinkForm')
		return reply
	})
	fastify.post('/login', async (req, res) => {
		let email = req.body.email;
		console.log(req.body)
		if (!email) {
			res.code(404)
		} else {
			// Check user email or create user if not exists
			let user = await SVC.findOrCreate(email)
			console.log('>>> user', user);
			/* with JWT
			// Generate token
			let d = new Date();
			d.setHours(d.getHours() + 1);
			const token = fastify.jwt.sign({ email, expiration: d })
			*/
			const token = await create(user.email, 3600 / 2)
			// Send email
			console.log('Magic Link', `${req.protocol}://${req.hostname}/auth?token=${token}`, email)
		}
		res.redirect(`/auth?email=${email}`);
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
			if(req.query.token) {
				// check provided token
				let email = await verify(req.query.token);
				console.log('auth', req.query, email)
				if(!email) {
					throw('Invalid Token')
				}
				let user = await SVC.findOrCreate(email)
				if(!user) {
					throw('Invalid Token')
				}
				/* with JWT
				// check token
				if(fastify.jwt.verify(req.params.token)) {

				} else {
					res.code(403).view('magicLinkForm', { error: 'Invalid token'})
				}
				*/
				// init session
				req.session.set('email', email);
				res.redirect(`/`)
			} else {
				// Propose to help 
				res.view('magicLinkInstructions', data);
			}
			return res
	})
	fastify.get('/logout', (req, res) => {
		// kill session
		req.session.delete()
		//return ok
		res.redirect('/')
	})
	done();
}