import { TagService } from "../services/tags.js";
import { AuthTokenService } from '../services/authtoken.js';
import { PdfService } from "../services/pdf.js";
import { nanoid } from "nanoid";

export default async function (fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'Pdf' }),
		TAGS = await TagService(fastify.mongo.db,  logger, fastify.config),
		AUTH = await AuthTokenService(fastify.mongo.db, logger, fastify.config),
		PDF = await PdfService(fastify.mongo.db, logger, fastify.config)

	fastify.route({
		method: ['GET', 'POST'],
		url: '/',
		preHandler: AUTH.authentified,
		handler: async (request, reply) => {
			let payload = { ...request.body, ...request.query }, //Get and POST
			data=[], list = [], currentPdf;
			// preview.cellWidth = preview.pageWidth / preview.perRow;
			// preview.cellHeight = preview.pageHeight/ preview.rows;
			let tags = await TAGS.findForUser(request.currentUserId(), { status: 'active' });
			tags.forEach(t => {
				let q = {
					...t,
					qty: 0
				};
				if (payload.qty && payload.qty[t._id]) {
					q.qty = parseInt(payload.qty[t._id]) || 0;
				}
				if (payload.printlabel && payload.printlabel[t._id] && payload.printlabel[t._id] == '1') {
					q.printlabel = true;
				}
				data.push(q)
			})
			// FIX user server session
			if(!request.session?.get('currentPdf')) {
				currentPdf = nanoid();
				request.session.set('currentPdf', currentPdf);
			} else {
				currentPdf = request.session.get('currentPdf');
			}
			if(payload.qty) {
				PDF.generate(currentPdf, data, payload.template, payload.skip);
			}
			reply.view('pdf/edit', {
				title: 'Label generator',
				data,
				tags,
				skip: payload.skip ?? 0,
				templates: PDF.templates,
				currentPdf: PDF.exists(currentPdf) ? currentPdf: false
			});
			return reply
		}
	});
	done();
}
