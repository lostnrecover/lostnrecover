import PDFDocument from 'pdfkit';
import { createWriteStream, existsSync } from 'fs';
import { TagService } from './tags.js';
import { QRService } from './qr.js';
import { join } from 'path';

const pdfpoint = 2.834666667;
const defaultTpl = "avL7120";
const templates = {
	"avL7120": {
		name: "Avery A4 35mmx35mm L7120",
		marginTop: 11,
		marginLeft: 7.5,
		hspace: 5,
		vspace: 5,
		rows: 7,
		perRow: 5,
		cellWidth: 35,
		cellHeight: 35,
		size: 'A4',
	},
	"avL7126": {
		name: "Avery A4 45mmx45mm L7126",
		marginTop: 26,
		marginLeft: 7.5,
		hspace: 5,
		vspace: 5,
		rows: 5,
		perRow: 4,
		cellWidth: 45,
		cellHeight: 45,
		size: 'A4'
	},
	"av25x25-S": {
		name: "Avery A4 25mmx25mm 25x25-S",
		marginTop: 14.5,
		marginLeft: 11.5,
		hspace: 2,
		vspace: 2,
		rows: 10,
		perRow: 7,
		cellWidth: 25,
		cellHeight: 25,
		size: 'A4'
	}
}

function getCol(position, perRow) {
	return ((position) % perRow);
}
function getLine(position, perRow) {
	return Math.trunc((position) / perRow)
}
function toPoint(inMM) {
	return Number(inMM) * pdfpoint
}

export async function PdfService(mongodb, parentLogger, config) {
	const logger = parentLogger.child({service: 'PDF'})
	const TAGS = await TagService(mongodb, logger, config);
	const QR = await QRService(mongodb, logger, config);

	function initDoc(pdfname, size) {
		let doc = new PDFDocument({
			size,
			margin: 0
		});
		doc.pipe(createWriteStream(pdfname));
		doc.info['Title'] = 'Tag stickers';
		doc.info['Author'] = config.appName;
		return doc
	}

	async function generate(pdfname, data, template, offset) {
		let startAt = offset ? Number(offset) : 0,
			list = [],
			p = getCachedFilename(pdfname),
			tpl = templates[template] ?? templates[defaultTpl],
			doc = initDoc(p, tpl.size),
			labelsPerPage = tpl.perRow * tpl.rows;

		await Promise.all(data.map(async (entry) => {
			let tagFile = await QR.getQRCodeFile(entry._id, 'png', true),
				arr = Array(parseInt(entry.qty) || 1).fill({...entry, tagFile});
			if(parseInt(entry.qty) > 0) {
				list.push(...arr);
			}
		}));

		list.forEach((e, index) => {
			let idx = (index + startAt) % labelsPerPage,
			angle = -90,
			posX = getCol(idx, tpl.perRow),
			posY = getLine(idx, tpl.perRow),
			x = tpl.marginLeft + posX * (tpl.hspace + tpl.cellWidth) ?? 0,
			y = tpl.marginTop + posY * (tpl.vspace + tpl.cellHeight) ?? 0,
			padding = 3,
			xRot = toPoint(x),
			yRot = toPoint(y+tpl.cellHeight) - 12;
			if(idx == 0 && index > 0) {
				doc.addPage();// {margin: 0});
			}
			logger.child({ e, startAt, idx, index, posX, posY, x, y, labelsPerPage}).debug('img atttributes')
			doc.image(e.tagFile, toPoint(x)+padding, toPoint(y)+padding, { width: toPoint(tpl.cellWidth)-2*padding });
			// .rect(toPoint(x), toPoint(y), toPoint(tpl.cellWidth), toPoint(tpl.cellHeight))
			// .stroke();
			doc.fontSize(8).text( config.SHORT_DOMAIN || config.DOMAIN, toPoint(x), toPoint(y)+2, { width: toPoint(tpl.cellWidth), align: 'center' });
			doc.fontSize(9).text(`ID: ${e._id}`, toPoint(x), toPoint(y+tpl.cellHeight)-9, { width: toPoint(tpl.cellWidth), align: 'center' } )
			if(e.printlabel) {
				doc.rotate( angle, { origin: [xRot,yRot] });
				doc.fontSize(9).fillColor('grey').text( `(${e.label})`, xRot, yRot, { width: toPoint(tpl.cellWidth)-24, align: 'center' }).fillColor('black');
				doc.rotate(angle * (-1), { origin: [xRot, yRot] });
			}
		});

		doc.file(Buffer.from(JSON.stringify({
			template: {
				...tpl,
				code: template
			},
			data: data
		})), {name: 'data.json' })
		doc.end();
	}

	function getCachedFilename(ref) {
		return join(config.pdf_cache_dir, `${ref}.pdf`);
	}
	function exists(filename) {
		return existsSync(getCachedFilename(filename));
	}
	return { templates, generate, exists}
}
