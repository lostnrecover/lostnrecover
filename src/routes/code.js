import { EXCEPTIONS } from '../services/exceptions.js';
import path from 'path';


export default async function (fastify, opts, done) {
	const 
		logger = fastify.log.child({ controller: 'QRCode' }),
		services = fastify.services;

	// code controller with /code/:format/:tagID route
	fastify.get('/:format/:tagId', {}, async (request, reply) => {
		let 
		// domain = fastify.config.SHORT_DOMAIN ?? `${request.protocol}://${request.hostname}`,
			tag = await services.TAGS.get(request.params.tagId);
		if (!tag) {
			throw EXCEPTIONS.NOT_FOUND;
		}
		let file = await services.QR.getQRCodeFile(tag._id, request.params.format, request.query.force ? true : false);
		await reply.sendFile(path.basename(file), path.dirname(file));
		return reply;
	});
	logger.debug('CodeRoute loaded');
	done();
}
