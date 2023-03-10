import Agenda from "agenda";
import { MessageService } from './services/messages.js'
let workerJob;

export async function initJobs(fastify, config) {
	let logger = fastify.log.child({module: 'job'}),
		MSG = await MessageService(fastify.mongo.db, logger, config, fastify.sendmail);
	if (!workerJob) {
		workerJob = new Agenda({ mongo: fastify.mongo.db });
		logger.info('Job worker started')
	} else {
		logger.info('Job already started')
	}
	MSG.registerJob(workerJob);
	workerJob.start();
}
