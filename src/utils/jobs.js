import Agenda from 'agenda';
let workerJob;

/* c8 ignore start : non need to test the job scheduler yet */
// TODO : add tests
export async function initJobs(fastify) {
	// fastify.addHook('onReady', async () => {
	let logger = fastify.log.child({module: 'job'});
	if (!workerJob) {
		workerJob = new Agenda({ mongo: fastify.mongo.db, ensureIndex: true });
		logger.info('Job worker started');
	} else {
		logger.info('Job already started');
	}
	fastify.decorate('workerJob', workerJob);
	fastify.services.MSG.registerJob(workerJob);
	fastify.services.DISC.registerJob(workerJob);
	
	// jobs = await workerJob.jobs({name: 'DummyJob'});
	// if(jobs.length > 0) {
	// 	dummyJob = jobs.pop();
	// 	jobs.forEach(j => j.remove());
	// } else {
	// 	dummyJob = workerJob.create(
	// 		'DummyJob',
	// 		{ priority: 'low' }, 
	// 		async () => {
	// 			fastify.log.error('Dummy Job execution!!!');
	// 		});
	// 	dummyJob.save();
	// }
	workerJob.start();
	// });
}
/* c8 ignore end */