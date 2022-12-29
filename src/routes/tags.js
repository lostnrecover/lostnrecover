import { EXCEPTIONS } from '../services/exceptions.js';
import { TagService } from '../services/tags.js';
import path from 'path';

export default function (fastify, opts, done) {
	const TAGS = TagService(fastify.mongo.db, fastify.log, opts.qrcode_cache);
	fastify.get('/:tagId', async (request, reply) => {
		let tag = await TAGS.get(request.params.tagId);
		if (!tag) {
			reply.code(404).view('tag/notfound');
		}
		// fastify.log.info(request.session.get('email'), tag.owner, request.query.edit)
		if (request.session.get('email') != tag.owner) {
			reply.view('tag/found', { tag });
			return reply
		}
		reply.redirect(`/tags/${tagId}`)
		return reply;
	});
	fastify.get('/:tagId/code.:format', async (request, reply) => {
		let domain = `${request.protocol}://${request.hostname}`,
		// `/t${request.params.tagId}`,
			tag = await TAGS.get(request.params.tagId);
		if (!tag) {
			return reply.code(404)
		}
		// if (request.params.format == 'png') {
		// 	reply.type('image/png');
		// } else {
		// 	reply.type('image/svg+xml');
		// }
		let file = await TAGS.getQRCodeFile(tag._id, domain, request.params.format, request.query.force ? true : false)
		reply.sendFile(file);
		return reply;
	});
	fastify.get('/:tagId/notify', async (request, reply) => {
		let tag = await TAGS.get(request.params.tagId);
		if (!tag) {
			return reply.code(404)
		}
		reply.view('tag/notified', { tag });
		return reply
	});
	fastify.post('/:tagId/notify', async (request, reply) => {
		let tag = await TAGS.get(request.params.tagId);
		if (!tag) {
			return reply.code(404)
		}
		if (!request.session || !request.session.email) {
			// Check user identity with an email
		}
		if (request.session.email == tag.owner) {
			// You can't get notified for your own tag ?
			throw(EXCEPTIONS.CANNOT_NOTIFY_OWNER)
		}
		// tag.status = 'found';
		// TODO: check active session before sending an email to avoid spreading personal information
		fastify.sendmail({
			subject: `Instructions for ${tag.name} (${tag._id})`, 
			template: 'mail/instructions', 
			context: { tag, email: request.body.email }, 
			to: request.body.email, 
			from: `"Tag Owner <tag-${tag._id}@lnf.z720.net>`
		});
		fastify.sendmail({
			subject: `Tag ${tag.name} was found (${tag._id})`,
			template: 'mail/found',
			context: { tag , email: request.body.share ? request.body.email : null },
			to: tag.email || tag.owner
		})
		reply.redirect(request.url);
		return reply
	});
	done()
}
