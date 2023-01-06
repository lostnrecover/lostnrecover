import { TagService } from "../services/tags.js";
import { AuthTokenService } from '../services/authtoken.js';
import { PdfService } from "../services/pdf.js";

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
			// let defaultPreview = {
			// 	rows: 6,
			// 	perRow: 4,
			// 	offset: 0,
			// 	pageWidth: 210,
			// 	pageHeight: 297,
			// 	marginTop: 0,
			// 	marginBottom: 0,
			// },
			let payload = { ...request.body, ...request.query },
			// preview = { ...defaultPreview, ...(payload?.preview ?? {}) },
			qty=[], grid=[], list = [];
			// preview.cellWidth = preview.pageWidth / preview.perRow;
			// preview.cellHeight = preview.pageHeight/ preview.rows;
			let tags = await TAGS.findForUser(request.session.email, { status: 'active' });
			tags.forEach(t => {
				let q = {
					...t,
					qty: 0
				}, qt
				if (payload.qty && payload.qty[t._id]) {
					let arr;
					q.qty = payload.qty[t._id];
					arr = Array(parseInt(q.qty) || 1).fill({_id: t._id});
					list.push(...arr);
				}
				qty.push(q)
			})
			// list.forEach((e, idx) => {
			// 	let el = { ...e }
			// 	el.posX = getCol(idx, preview.perRow)
			// 	el.posY = getLine(idx, preview.perRow)
			// 	el.cellWidth = preview.cellWidth
			// 	el.cellHeight = preview.cellHeight
			// 	el.x = el.posX * preview.cellHeight
			// 	el.y = el.posY * preview.cellWidth
			// 	el.idx = idx
			// 	logger.debug('el', idx, el);
			// 	grid.push(el);
			// })
			if(payload.qty) {
				PDF.generate('test.pdf', payload.qty);
			}
			reply.view('pdf/edit', { qty, tags, grid });
			return reply
		}
		/*
		<svg width="100%" height="100%" viewBox="-100 -100 200 200" version="1.1"
     xmlns="http://www.w3.org/2000/svg">
  <circle cx="-50" cy="-50" r="30" style="fill:red" />
  <image x="10" y="20" width="80" height="80" href="recursion.svg" />
</svg>
		*/
	});
	done();
}
