import { initApp } from "./app.js";
import { config } from './config.js';

let fastify = initApp();

// Start server
const start = async () => {
	try {
		await fastify.listen({
			port: config.PORT,
			host: config.HOST
		});
		console.log(`Server started ${config.HOST}:${config.PORT}`)

	} catch(err) {
		fastify.log.error((err))
		process.exit(1)
	}
}
start()