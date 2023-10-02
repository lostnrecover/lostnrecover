import { nanoid } from "nanoid";
import { EXCEPTIONS } from "../../services/exceptions.js";

export default async function (fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'Pdf' }),
				services = fastify.services;

	fastify.get('/batch', {
		preHandler: fastify.isAdmin
	}, async (request, reply) => {
		// TODO List batchs	
		let batches = await services.PDF.getBatches();
			// show form
			reply.view('pdf/batch-list', {
				batches,
				templates: services.PDF.templates
			})
			return reply;
	})
	fastify.post('/batch', {
		preHandler: fastify.isAdmin
	}, async (request, reply) => {
		let payload = {batchId: nanoid(), ...request.query, ...request.body}, 
		tagtpl = { status: 'new', batchId: payload.batchId, creator_id: request.currentUserId() };
		await services.PDF.batchPrint(payload.batchId, tagtpl, payload.qty ?? 1, payload.selectedTemplate, payload.skip ?? 0);
		reply.redirect(`${opts.prefix}/batch/${payload.batchId}`);
		return reply;
	});

	fastify.route({
		method: [ 'GET', 'POST'],
		url: '/batch/:batchId',
		preHandler: fastify.isAdmin,
		handler: async (request, reply) => {
			// Fetch current batch in db
			let batch = await services.PDF.getBatch(request.params.batchId);
			if(!batch) {
				throw EXCEPTIONS.NOT_FOUND;
			}
			if(request.method == 'POST') {
				batch = {
					...batch, 
					pageCount: request.body.pageCount, 
					pageFormat: request.body.pageFormat,
					status: request.body.status == 'locked' ? 'locked' : 'new',
					skip: request.body.skip ?? 0,
					withlabel: (request.body.withlabel ?? false) == 1
				}
				if(batch.tagTemplate) {
					batch.tagTemplate.label = request.body.label ?? "";
				}
				batch = await services.PDF.updateBatch(batch);
				// (batch._id, tagtpl, batch.qty, batch.pageFormat, batch.skip) 
				reply.redirect(request.url);
				return reply;
			}
			// show form
			reply.view('pdf/batch', {
				batch,
				templates: services.PDF.templates,
				currentPdf: services.PDF.exists(batch._id) ? batch._id : false
			})
			return reply;
		}
	})

	fastify.route({
		method: ['GET', 'POST'],
		url: '/batch/advanced',
		preHandler: fastify.isAdmin,
		handler: async (request, reply) => {
			let vars = {...request.query, ...request.body};
			if(request.method.toLowerCase() == 'post' 
			&& vars.qty > 0) {
				// create X tags
				let tagTpl = {
					label: (vars.withlabel ?? false) ? vars.label : "",
				}, batch;
				if(vars.forowner == 1) {
					tagTpl.owner_id = request.currentUserId();
					tagTpl.status = 'active';
				} else {
					tagTpl.status = 'new';
				}
				batch = await services.PDF.batchPrint(null, tagTpl, 1, vars.tpl, vars.skip, vars.withlabel == 1)
				reply.redirect(`${batch._id}`);
				return reply;
			}
			reply.view('pdf/batch-advanced', {
				qty: vars.qty ?? 1,
				selectedTemplate: vars.tpl ?? null,
				skip: vars.skip ?? 0, 
				forowner: (vars.forowner == 1) ? 1 : 0,
				templates: services.PDF.templates,
				withlabel: vars.withlabel ?? false,
				label: vars.label ?? "",
				print_id: vars.print_id ?? ""
			})
			return reply
		}
	});
	done();
}
