import { EXCEPTIONS } from '../services/exceptions.js';
import { SCHEMA } from '../services/instructions.js';

export default async function (fastify, opts, done) {
	const 
		logger = fastify.log.child({ controller: 'Instructions' }),
		services = fastify.services;

	async function filterInput(request, instructions) {
		instructions.name = request.body.name || '';
		instructions.body = request.body.body || '';
		instructions.isDefault = request.body.isDefault ? true : false;
		return instructions;
	}

	fastify.get('/', {
		preHandler: fastify.authentified
	}, async (request, reply) => {
		if (request.query.create) {
			let instructions = {
				name: '',
				body: ''
			};
			reply.view('instructions/new', { instructions  });
		} else {
			let instructions = await services.INSTRUCTIONS.findForUser(request.currentUserId());
			reply.view('instructions/list', { instructions });
		}
		return reply;
	});

	fastify.post('/',{ 
		schema: SCHEMA, 
		preHandler: fastify.authentified 
	}, async (request, reply) => {
		let newInstr = await filterInput(request, { owner_id: request.currentUserId() });
		let inst = await services.INSTRUCTIONS.create(newInstr);
		if(newInstr.isDefault) {
			services.USERS.update(request.currentUserId(), { defaultInstructions: inst._id }).catch(e => {
				logger.error({error:e, instructions: inst}, 'Failed to save default instructions');
			});
		}
		reply.redirect(`${opts.prefix}/${inst._id}?edit=1`);
		return reply;
	});
	fastify.get('/:instructionsId', {
		preHandler: fastify.authentified
	}, async (request, reply) => {
		let instructions = await services.INSTRUCTIONS.getForUpdate(request.params.instructionsId, request.currentUserId());
		if (!instructions) {
			throw(EXCEPTIONS.NOT_FOUND);
		}
		reply.view('instructions/edit', { instructions });
		return reply;
	});
	fastify.post('/:instructionsId', { 
		schema: SCHEMA, 
		preHandler: fastify.authentified 
	}, async (request, reply) => {
		let instructions = await services.INSTRUCTIONS.getForUpdate(request.params.instructionsId, request.currentUserId());
		if (!instructions) {
			throw(EXCEPTIONS.NOT_FOUND);
		}
		instructions = await filterInput(request, instructions);
		await services.INSTRUCTIONS.update(instructions._id, instructions);
		if(request.body.isDefault) {
			services.USERS.update(request.currentUserId(), { defaultInstructions: instructions._id }).catch(e => {
				logger.error({error:e, instructions}, 'Failed to save default instructions');
			});
		}
		reply.redirect(request.url);
		return reply;
	});

	fastify.post('/:instructionsId/delete', {
		preHandler: fastify.authentified
	}, async (request, reply) => {
		let instructions = await services.INSTRUCTIONS.getForUpdate(request.params.instructionsId, request.currentUserId());
		if(!instructions) {
			throw(EXCEPTIONS.NOT_FOUND);
		}
		if(instructions.tags.length > 0 || instructions.isDefault) {
			throw(EXCEPTIONS.BAD_REQUEST);
		}
		services.INSTRUCTIONS.remove({ _id: instructions._id});
		request.flash('success', `${instructions.name} instructions removed (${instructions._id})`);
		reply.redirect(`${opts.prefix}`);
		return reply;
	});

	logger.debug(`Loaded Instructions at ${opts.prefix}`);
	done();
}