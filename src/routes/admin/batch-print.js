import { TagService } from "../../services/tags.js";
import { AuthTokenService } from '../../services/authtoken.js';
import { PdfService } from "../../services/pdf.js";
import { nanoid } from "nanoid";
import { EXCEPTIONS } from "../../services/exceptions.js";

export default async function (fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'Pdf' }),
		TAGS = await TagService(fastify.mongo.db,  logger, fastify.config),
		AUTH = await AuthTokenService(fastify.mongo.db, logger, fastify.config),
		PDF = await PdfService(fastify.mongo.db, logger, fastify.config)

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
				let tagtpl = { status: 'new', batchId: batch._id, creator_id: request.currentUserId() };
				batch = {
					...batch, 
					pageCount: request.body.pageCount, 
					pageFormat: request.body.pageFormat,
					status: request.body.status == 'locked' ? 'locked' : 'draft'
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
				// qty: batch.qty ?? 1,
				// selectedTemplate: batch.pageFormat ?? null,
				// skip: batch.skip ?? 0, 
				templates: PDF.templates,
				// batchId: batch._id, 
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
				let tpl = {
					label: (vars.withlabel ?? false) ? vars.label : "",
				}, tags = [], batch;
				if(vars.forowner == 1) {
					tpl.owner_id = request.currentUserId();
					tpl.status = 'active';
				} else {
					tpl.status = 'new';
				}
				batch = await PDF.batchPrint({}, tpl, 1, null, vars.skip)
				// tags = await TAGS.bulkCreate(tpl, parseInt(vars.qty));
				// // generate pdf
				// PDF.generate(tags[0].batchId, tags.map(t => { return {...t, qty: 1, printlabel: vars.withlabel ?? false} } ))
				reply.redirect(`../${batch._id}`);
				return reply;
			}
			reply.view('pdf/batch-advanced', {
				title: 'Batch print labels',
				qty: vars.qty ?? 0,
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
