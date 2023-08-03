import { EXCEPTIONS } from '../services/exceptions.js';
import { TagService } from '../services/tags.js';
import { QRService } from '../services/qr.js';
import path from 'path';


export default async function (fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'QRCode' }),
		TAGS = await TagService(fastify.mongo.db, logger, fastify.config),
		QR = await QRService(fastify.mongo, logger, fastify.config);

// code controller with /code/:format/:tagID route
	fastify.get('/:format/:tagId', {}, async (request, reply) => {
		let domain = fastify.config.SHORT_DOMAIN ?? `${request.protocol}://${request.hostname}`,
			tag = await TAGS.get(request.params.tagId);
		if (!tag) {
			throw EXCEPTIONS.NOT_FOUND;
		}
		let file = await QR.getQRCodeFile(tag._id, request.params.format, request.query.force ? true : false)
		let t = await reply.sendFile(path.basename(file), path.dirname(file));
		return reply;
	});
	done();
}
