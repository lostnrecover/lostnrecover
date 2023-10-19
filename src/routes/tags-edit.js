import { EXCEPTIONS } from '../services/exceptions.js';
import { SCHEMA, STATUS } from '../services/tags.js';
import { STATUS as DISC_STATUS } from '../services/discovery.js';

export default async function (fastify, opts, done) {
	const 
		logger = fastify.log.child({ controller: 'TagsEdit' }),
		services = fastify.services;

	async function filterInput(request, tag) {
		tag.name = request.body.name || '';
		tag.label = request.body.label || '';
		if(request.body.email !== request.serverSession.user.email) {
			let recipient = await services.USERS.findOrCreate(request.body.email, 'recipient');
			tag.recipient_id = recipient._id;
		} else {
			tag.recipient_id = request.currentUserId();
		}
		tag.instructions_id = request.body.instructions_id;
		return tag;
	}
	fastify.get('/', {
		preHandler: fastify.authentified
	}, async (request, reply) => {
		if (request.query.create) {
			let tag = {
				// Default tag owner to current session
					email: request.serverSession.user.email
				}, instructions = await services.INSTRUCTIONS.findForUser(request.currentUserId()),
				defs = instructions.filter(i => i.isDefault);
			if(defs > 0) {
				tag.instructions_id = defs[0]._id;
			}
			reply.view('tag/new', { tag, instructions });
		} else {
			let tags = await services.TAGS.findForUser(request.currentUserId());
			reply.view('tag/list', { tags });
		}
		return reply;
	});
	fastify.post('/',{ 
		schema: SCHEMA,
		preHandler: fastify.authentified 
	}, async (request, reply) => {
		let newTag = await filterInput(request, {
			status: STATUS.ACTIVE, 
			owner_id: request.currentUserId(), 
			creator_id: request.currentUserId() 
		});
		//{status: STATUS.ACTIVE, ...request.body, owner_id: request.currentUserId()};
		let tag = await services.TAGS.create(newTag);
		reply.redirect(`/tags/${tag._id}?edit=1`);
	});
	fastify.get('/:tagId', {
		preHandler: fastify.authentified
	}, async (request, reply) => {
		let tag = await services.TAGS.get(request.params.tagId), recipient = null, instructions = await services.INSTRUCTIONS.findForUser(request.currentUserId());
		if (!tag) {
			throw(EXCEPTIONS.TAG_NOT_FOUND);
		}
		if (!request.isCurrentUser(tag.owner_id)) {
			// Not the tag owner : redirect to the view path
			reply.redirect(`/t/${tag._id}`);
			// reply.view('tag/found', { tag });
			return reply;
		}
		// Show recipient email
		if(tag.recipient_id) {
			recipient = await services.USERS.findById(tag.recipient_id);
			tag.email = recipient.email;
		} else {
			tag.email = request.serverSession.user.email;
		}
		if (request.query.edit) {
			reply.view('tag/edit', { tag, instructions });
		} else {
			reply.view('tag/view', { tag, instructions });
		}
		return reply;
	});
	fastify.post('/:tagId', { 
		schema: SCHEMA, 
		preHandler: fastify.authentified 
	}, async (request, reply) => {
		let tag = await services.TAGS.getForUpdate(request.params.tagId, request.currentUserId());
		if (!tag) {
			throw(EXCEPTIONS.TAG_NOT_FOUND);
		}
		tag = await filterInput(request, tag);
		await services.TAGS.update(tag._id, tag);
		reply.redirect(request.url);
	});
	fastify.get('/:tagId/preview', {
		preHandler: fastify.authentified
	}, async (request, reply) => {
		let tag = await services.TAGS.get(request.params.tagId), discovery = {
			status: DISC_STATUS.ACTIVE,
			tag,
			instructions: tag.instructions,
		};
		if (!tag) {
			throw(EXCEPTIONS.TAG_NOT_FOUND);
		}
		if (!request.isCurrentUser(tag.owner_id)) {
			// Not the tag owner : redirect to the view path
			reply.redirect(`/t/${tag._id}`);
			// reply.view('tag/found', { tag });
			return reply;
		}
		reply.view('tag/discovery/instructions', { discovery, isFinder: true, isTagOwner: false});
		return reply;
	});

	async function patchStatus(request, reply, action) {
		let tag = await services.TAGS.getForUpdate(request.params.tagId, request.currentUserId()),
			actions = {
				'lost': { status: STATUS.LOST },
				'active': { status: STATUS.ACTIVE, owner_id: request.currentUserId() }
			};
		if(!tag) {
			throw(EXCEPTIONS.TAG_NOT_FOUND);
		}
		if(!Object.keys(actions).includes(action)) {
			throw(EXCEPTIONS.NOT_FOUND);
		}
		services.TAGS.update(tag._id, actions[action]);
		if(request.body.redirect) {
			reply.redirect(request.body.redirect);
		} else {
			reply.redirect(request.url.replace(`/${action}`,''));
		}
		return reply;
	}
	fastify.post('/:tagId/lost', {
		preHandler: fastify.authentified
	}, async (request, reply) => {
		return await patchStatus(request, reply, STATUS.LOST);
	});
	fastify.post('/:tagId/active', {
		preHandler: fastify.authentified
	}, async (request, reply) => {
		return await patchStatus(request, reply, STATUS.ACTIVE);
	});
	logger.debug('TagsEditRoute loaded');
	done();
}
