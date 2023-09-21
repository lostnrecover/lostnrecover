import { nanoid } from "nanoid";

export default async function (fastify, opts, done) {
	const 
		logger = fastify.log.child({ controller: 'Pdf' }),
		services = fastify.services;

	fastify.route({
		method: ['GET', 'POST'],
		url: '/',
		preHandler: fastify.authentified,
		handler: async (request, reply) => {
			let payload = { ...request.body, ...request.query }, //Get and POST
			data=[], list = [], currentPdf;
			// preview.cellWidth = preview.pageWidth / preview.perRow;
			// preview.cellHeight = preview.pageHeight/ preview.rows;
			let tags = await services.TAGS.findForUser(request.currentUserId(), { status: 'active' });
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
				services.PDF.generate(currentPdf, data, payload.template, payload.skip);
			}
			reply.view('pdf/edit', {
				title: 'Label generator',
				data,
				tags,
				skip: payload.skip ?? 0,
				templates: services.PDF.templates,
				currentPdf: services.PDF.exists(currentPdf) ? currentPdf: false
			});
			return reply
		}
	});
	done();
}
