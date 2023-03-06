import { EXCEPTIONS } from '../services/exceptions.js';
import { TagService } from '../services/tags.js';

export default async function (fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'QRCode' }),
		TAGS = await TagService(fastify.mongo.db, logger, fastify.config);

// code controller with /code/:format/:tagID route
	fastify.get('/:format/:tagId', {}, async (request, reply) => {
		let domain = fastify.config.SHORT_DOMAIN ?? `${request.protocol}://${request.hostname}`,
			tag = await TAGS.get(request.params.tagId);
		if (!tag) {
			throw EXCEPTIONS.NOT_FOUND;
		}
		let file = await TAGS.getQRCodeFile(tag._id, request.params.format, request.query.force ? true : false)
		reply.sendFile(file);
		return reply;
	});
	done();
}
