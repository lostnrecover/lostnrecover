import PDFDocument from 'pdfkit';
import fs from 'fs';
import { TagService } from './tags.js';
import path from 'path';

const pdfpoint = 2.834666667;
const defaultTpl = "Avery A4 35mmx35mm L7120";
const templates = {
	"Avery A4 35mmx35mm L7120": {
		marginTop: 11,
		marginLeft: 7.5,
		hspace: 5,
		vspace: 5,
		rows: 7,
		perRow: 5,
		cellWidth: 35,
		cellHeight: 35,
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

export function PdfService(mongodb, parentLogger, config) {
	const logger = parentLogger.child({service: 'PDF'})
	const TAGS = TagService(mongodb, logger, config);

	function initDoc(pdfname, size) {
		let doc = new PDFDocument({size});
		doc.pipe(fs.createWriteStream(pdfname));
		doc.info['Title'] = 'Tag stickers';
		doc.info['Author'] = config.app_name;
		return doc
	}

	async function generate(pdfname, quantity, template, offset) {
		let startAt = offset ?? 2,
			list = [],
			p = path.join(config.cache_dir, 'pdf-' + pdfname),
			tpl = template ?? templates[defaultTpl],
			doc = initDoc(p, tpl.size);
			// xOffset = tpl.marginLeft - tpl.hspace,
			// yOffset = tpl.marginTop - tpl.vspace;
		await Promise.all(Object.entries(quantity).map(async (entry) => {
			let [tag,q] = entry,
			tagFile = await TAGS.getQRCodeFile(tag, 'png', true),
			arr = Array(parseInt(q) || 1).fill({tag, tagFile});
			if(parseInt(q) > 0) {
				list.push(...arr);
			}
		}));
		console.log([...arguments, list])
		list.forEach((e, idx) => {
			let	posX = getCol(idx + startAt, tpl.perRow),
				posY = getLine(idx + startAt, tpl.perRow),
				x = tpl.marginLeft + posX * (tpl.hspace + tpl.cellWidth) ?? 0,
				y = tpl.marginTop + posY * (tpl.vspace + tpl.cellHeight) ?? 0;
			console.log('img', { e, idx, posX, posY, x, y });
			doc.image(e.tagFile, toPoint(x), toPoint(y), { width: toPoint(tpl.cellWidth) })
				.rect(toPoint(x), toPoint(y), toPoint(tpl.cellWidth), toPoint(tpl.cellHeight))
				.stroke();
			doc.fontSize(9).text(e.tag, toPoint(x), toPoint(y+tpl.cellHeight-3), { width: toPoint(tpl.cellWidth), align: 'center' } )
		});
		doc.end();
	}
	return { templates: Object.keys(templates), generate }
}
