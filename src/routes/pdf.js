import { TagService } from "../services/tags.js";
import { AuthTokenService } from '../services/authtoken.js';
import { PdfService } from "../services/pdf.js";
import { nanoid } from "nanoid";

export default function (fastify, opts, done) {
	const logger = fastify.log.child({ controller: 'Pdf' }),
		TAGS = TagService(fastify.mongo.db,  logger, fastify.config),
		AUTH = AuthTokenService(fastify.mongo.db, logger, fastify.config),
		PDF = PdfService(fastify.mongo.db, logger, fastify.config)

	fastify.route({
		method: ['GET', 'POST'],
		url: '/',
		preHandler: AUTH.authentified,
		handler: async (request, reply) => {
			let payload = { ...request.body, ...request.query }, //Get and POST
			data=[], list = [];
			// preview.cellWidth = preview.pageWidth / preview.perRow;
			// preview.cellHeight = preview.pageHeight/ preview.rows;
			let tags = await TAGS.findForUser(request.session.email, { status: 'active' });
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
			if(!request.session.currentPdf) {
				request.session.currentPdf = nanoid();
			}
			if(payload.qty) {
				PDF.generate(request.session.currentPdf, data, payload.template, payload.skip);
			}
			reply.view('pdf/edit', {
				title: 'Label generator',
				data,
				tags,
				skip: payload.skip ?? 0,
				templates: PDF.templates,
				currentPdf: PDF.exists(request.session.currentPdf) ? request.session.currentPdf : false
			});
			return reply
		}
	});
	done();
}
