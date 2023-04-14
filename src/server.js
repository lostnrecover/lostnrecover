import { initApp } from "./app.js";
import { config } from './config.js';

let server = await initApp();

server.addHook('onReady', async () => {
	await server.initJobs();
})
// Start server
const start = async () => {
	try {
		server.listen({
			port: config.PORT,
			host: config.HOST
		});
		console.log(`Server started ${config.HOST}:${config.PORT}`)
	} catch(err) {
		server.log.error((err))
		process.exit(1)
	}
}
start()