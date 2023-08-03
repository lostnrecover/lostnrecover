import { initApp } from "./app.js";
import { config } from './config.js';

let server = await initApp();

// reco: https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/
async function closeGracefully(signal) {
	console.log(`*^!@4=> Received signal to terminate: ${signal}`)

	await server.close()
	// await db.close() if we have a db connection in this app
	// await other things we should cleanup nicely
	process.kill(process.pid, signal);
}
process.once('SIGINT', closeGracefully)
process.once('SIGTERM', closeGracefully)

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
		console.log(`Server started ${config.HOST}:${config.PORT} // ${config.appId}`)
	} catch(err) {
		server.log.error((err))
		process.exit(1)
	}
}
start()
