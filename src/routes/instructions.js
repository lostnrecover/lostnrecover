import { EXCEPTIONS } from "../services/exceptions.js";
import { InstructionsService } from "../services/instructions.js";
import { AuthTokenService } from '../services/authtoken.js';

export default async function (fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'Instructions' }),
	AUTH = await AuthTokenService(fastify.mongo.db, logger, fastify.config),
	INSTRUCTIONS = await InstructionsService(fastify.mongo.db, logger, fastify.config);

	async function filterInput(request, instructions) {
		instructions.name = request.body.name || '';
		instructions.body = request.body.body || '';
		instructions.isDefault = request.body.isDefault ? true : false;
		return instructions;
	}

	fastify.get('/', {
		preHandler: AUTH.authentified
	}, async (request, reply) => {
		if (request.query.create) {
			let instructions = {
				name: "",
				body: ""
			}
			reply.view('instructions/new', { instructions, title: 'New instructions' })
		} else {
			let instructions = await INSTRUCTIONS.findForUser(request.currentUserId());
			reply.view('instructions/list', { instructions, title: 'Instructions' });
		}
		return reply;
	});

	fastify.post('/',{ 
		schema: INSTRUCTIONS.SCHEMA, 
		preHandler: AUTH.authentified 
	}, async (request, reply) => {
		let newInstr = await filterInput(request, { owner_id: request.currentUserId() });
		let inst = await INSTRUCTIONS.create(newInstr);
		reply.redirect(`${opts.prefix}/${inst._id}?edit=1`);
		return reply;
	})
	fastify.get('/:instructionsId', {
		preHandler: AUTH.authentified
	}, async (request, reply) => {
		let instructions = await INSTRUCTIONS.getForUpdate(request.params.instructionsId, request.currentUserId());
		if (!instructions) {
			throw(EXCEPTIONS.NOT_FOUND);
		}
		reply.view('instructions/edit', { instructions, title: 'Review instructions' });
		return reply;
	});
	fastify.post('/:instructionsId', { 
		schema: INSTRUCTIONS.SCHEMA, 
		preHandler: AUTH.authentified 
	}, async (request, reply) => {
		let instructions = await INSTRUCTIONS.getForUpdate(request.params.instructionsId, request.currentUserId());
		if (!instructions) {
			throw(EXCEPTIONS.NOT_FOUND)
		}
		instructions = await filterInput(request, instructions);
		await INSTRUCTIONS.update(instructions._id, instructions);
		reply.redirect(request.url);
		return reply;
	});

	fastify.post('/:instructionsId/delete', {
		preHandler: AUTH.authentified
	}, async (request, reply) => {
		let instructions = await INSTRUCTIONS.getForUpdate(request.params.instructionsId, request.currentUserId());
		if(!instructions) {
			throw(EXCEPTIONS.NOT_FOUND);
		}
		if(instructions.tags.length > 0 || instructions.isDefault) {
			throw(EXCEPTIONS.BAD_REQUEST);
		}
		INSTRUCTIONS.remove({ _id: instructions._id});
		request.flash('success', `${instructions.name} instructions removed (${instructions._id})`)
		reply.redirect(`${opts.prefix}`);
		return reply;
	})

	logger.debug(`Loaded Instructions at ${opts.prefix}`)
	done();
}