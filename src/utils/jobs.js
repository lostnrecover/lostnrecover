import Agenda from 'agenda';
let workerJob;

/* c8 ignore start : non need to test the job scheduler yet */
// TODO : add tests
export async function initJobs(fastify) {
	fastify.addHook('onReady', async () => {
		let logger = fastify.log.child({module: 'job'});
		if (!workerJob) {
			workerJob = new Agenda({ mongo: fastify.mongo.db });
			logger.info('Job worker started');
		} else {
			logger.info('Job already started');
		}
		fastify.services.MSG.registerJob(workerJob);
		workerJob.start();
	});
}
/* c8 ignore end */