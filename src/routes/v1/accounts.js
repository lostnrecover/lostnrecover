// src/routes/v1/accounts.js
export default function(fastify, opts, done) {
	fastify.post('/login', (req, res) => {
		res.send('ok');
	})
	fastify.post('/logout', (req, res) => {
		// kill session
		//return ok
	})
	done();
}