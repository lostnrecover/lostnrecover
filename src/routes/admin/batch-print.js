import { TagService } from "../../services/tags.js";
import { AuthTokenService } from '../../services/authtoken.js';
import { PdfService } from "../../services/pdf.js";
import { nanoid } from "nanoid";
import { EXCEPTIONS } from "../../services/exceptions.js";

export default async function (fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'Pdf' }),
		TAGS = await TagService(fastify.mongo.db,  logger, fastify.config),
		AUTH = await AuthTokenService(fastify.mongo.db, logger, fastify.config),
		PDF = await PdfService(fastify.mongo.db, logger, fastify.config);

	fastify.get('/batch', {
		preHandler: AUTH.isAdmin
	}, async (request, reply) => {
		// TODO List batchs	
		let batches = await PDF.getBatches();
			// show form
			reply.view('pdf/batch-list', {
				title: 'Batch prints',
				batches,
				templates: PDF.templates
			})
			return reply;
	})
	fastify.post('/batch', {
		preHandler: AUTH.isAdmin
	}, async (request, reply) => {
		let payload = {batchId: nanoid(), ...request.query, ...request.body}, 
		tagtpl = { status: 'new', batchId: payload.batchId, creator_id: request.currentUserId() };
		await PDF.batchPrint(payload.batchId, tagtpl, payload.qty ?? 1, payload.selectedTemplate, payload.skip ?? 0);
		reply.redirect(`${opts.prefix}/batch/${payload.batchId}`);
		return reply;
	});

	fastify.route({
		method: [ 'GET', 'POST'],
		url: '/batch/:batchId',
		preHandler: AUTH.isAdmin,
		handler: async (request, reply) => {
			// Fetch current batch in db
			let batch = await PDF.getBatch(request.params.batchId);
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
				batch = await PDF.updateBatch(batch);
				// (batch._id, tagtpl, batch.qty, batch.pageFormat, batch.skip) 
				reply.redirect(request.url);
				return reply;
			}
			// show form
			reply.view('pdf/batch', {
				title: 'Batch print labels',
				batch,
				templates: PDF.templates,
				currentPdf: PDF.exists(batch._id) ? batch._id : false
			})
			return reply;
		}
	})

	fastify.route({
		method: ['GET', 'POST'],
		url: '/batch/advanced',
		preHandler: AUTH.isAdmin,
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
				batch = await PDF.batchPrint(null, tagTpl, 1, vars.tpl, vars.skip, vars.withlabel == 1)
				// tags = await TAGS.bulkCreate(tpl, parseInt(vars.qty));
				// // generate pdf
				// PDF.generate(tags[0].batchId, tags.map(t => { return {...t, qty: 1, printlabel: vars.withlabel ?? false} } ))
				reply.redirect(`${batch._id}`);
				return reply;
			}
			reply.view('pdf/batch-advanced', {
				title: 'Batch print labels',
				qty: vars.qty ?? 1,
				selectedTemplate: vars.tpl ?? null,
				skip: vars.skip ?? 0, 
				forowner: (vars.forowner == 1) ? 1 : 0,
				templates: PDF.templates,
				withlabel: vars.withlabel ?? false,
				label: vars.label ?? "",
				print_id: vars.print_id ?? ""
			})
			return reply
		}
	});
	done();
}
