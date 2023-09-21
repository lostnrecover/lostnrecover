import Agenda from "agenda";
let workerJob;

export async function initJobs(fastify, config) {
	fastify.addHook('onReady', async () => {
		let logger = fastify.log.child({module: 'job'});
		if (!workerJob) {
			workerJob = new Agenda({ mongo: fastify.mongo.db });
			logger.info('Job worker started')
		} else {
			logger.info('Job already started')
		}
		fastify.services.MSG.registerJob(workerJob);
		workerJob.start();
	});
}
