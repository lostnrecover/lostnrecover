import PDFDocument from 'pdfkit';
import { createWriteStream, existsSync } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { initCollection } from '../utils/db.js';
import { EXCEPTIONS } from './exceptions.js';
import { readFile } from 'fs/promises';
import Ajv from 'ajv';

const ajv = new Ajv();
const pdfpoint = 2.834666667;
let DEFAULT_TPL = "avL7120";
const templates = {
	"avery-L7120": {
		"id": "avery-L7120",
		"name": "Avery A4 35mmx35mm L7120",
		"marginTop": 18.5,
		"marginLeft": 12,
		"hspace": 2.5,
		"vspace": 2.5,
		"rows": 7,
		"perRow": 5,
		"cellWidth": 35,
		"cellHeight": 35,
		"size": "A4"
	},
	"avery-25x25-S": {
		id: "avery-25x25-S",
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

export async function PdfService(mongodb, parentLogger, config, TAGS, QR) {
	const logger = parentLogger.child({service: 'PDF'}),
		COLLECTION = 'prints';
	let PRINTS = await initCollection(mongodb, COLLECTION);

	loadTemplates();

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

	async function loadTemplates() {
		try {
			let s = await readFile(join(config.data_dir, 'templates.schema.json')),
					validate = ajv.compile(JSON.parse(s.toString())),
					t = await readFile(join(config.data_dir, 'templates.json')),
					tpls = JSON.parse(t.toString());
			const valid = validate(tpls);
			if(!valid) {
				throw(ajv.errors);
			}
			tpls.forEach(e => {
				e.tagCount = e.perRow * e.rows;
				templates[e.id] = e;
			});
			DEFAULT_TPL = tpls[0].id;
			logger.info(`Loaded ${Object.keys(templates).length} templates (${DEFAULT_TPL})`)
		} catch(e) {
			logger.error(e);
			logger.error(`Impossible to load templates from data_dir: ${e}`)
		}		
	}

	async function elasticTagBatch(batchId, tagCount, tpl) {
		let tagsInBatch, 
			filter={ batchId , status: 'new' }, 
			tagTemplate = { ...tpl, batchId }
		TAGS.bulkSet(filter, tagTemplate);
		tagsInBatch = await TAGS.search(filter); // TODO should we filter with creator ?
		if(tagsInBatch.length < tagCount) {
			// Add more tags 
			let nt = await TAGS.bulkCreate(tagTemplate, tagCount-tagsInBatch.length);
			tagsInBatch.push(...nt)
		} else if(tagsInBatch.length > tagCount) {
			// remove if too much
			let removed = tagsInBatch.splice(tagCount);
			TAGS.remove({ 
				$and: [ 
					{'_id': { $in: removed.map(t => t._id) }},
					{ batchId: batchId }
				]
			 });
		}
		// update all with label and other attrbitues from template ?
		return tagsInBatch;
		//  = newTags.map(t => { return {...t, qty: 1, printlabel: false} } )
	} 

	async function createOrUpdateAdvancedBatch(batch) {
		let tagTemplate = {...batch.tagTemplate }, 
			pageTemplate = templates[batch.pageFormat] ?? templates[DEFAULT_TPL], 
			tagCount = (batch.pageCount * pageTemplate.perRow * pageTemplate.rows) - batch.skip,
			newTags = await elasticTagBatch(batch._id, tagCount, tagTemplate);
		newTags = newTags.map((t,i) => { return {...t, qty: 1, printlabel: batch.withlabel} } ) 
		generate(batch._id, newTags, pageTemplate.id, batch.skip);
		if(exists(batch._id)) {
			batch.file = getCachedFilename(batch._id);
			batch.file = batch.file.replace(config.pdf_cache_dir,'');
		}
		return await saveBatch(batch);
	}

	async function batchPrint(batchId, tagTpl, pageCount, pageFormat, skip, withLabel) {
		let batch = {
				_id: batchId ?? nanoid(),
				type: 'new-tags',
				pageFormat: templates.hasOwnProperty(pageFormat) ? pageFormat : DEFAULT_TPL,
				pageCount: pageCount, 
				withlabel: !!withLabel,
				tagTemplate: {...tagTpl, status: 'new'},
				skip: skip ?? 0
			};
			return await createOrUpdateAdvancedBatch(batch);
	}

	async function updateBatch(batchInput) {
		let b = await getBatch(batchInput._id),
			batch = {...b, ...batchInput};
		if(b.status != 'new') {
			throw EXCEPTIONS.BAD_REQUEST;
		}
		if(b.type == 'new-tags') {
			return await createOrUpdateAdvancedBatch(batch);
		} else {
			return await saveBatch(b)
		}
	}

	async function saveBatch(batch) {
		const query = { _id: batch._id }, 
			update = { $set: batch},
			options = { upsert: true };
		if(!batch.hasOwnProperty('status')) {
			batch.status = 'new'
		} else {
			batch.status = (batch.status == 'new') ? 'new' : 'locked'
		}
		await PRINTS.updateOne(query, update, options);
		return await getBatch(batch._id);
	}

	async function getBatches(filter) {
		let batches = PRINTS.find(filter);
		return await batches.toArray();
	}
	async function getBatch(id) {
		let res = await getBatches({_id: id});
		return res[0];
	}

	async function generate(pdfname, data, template, offset) {
		let startAt = offset ? Number(offset) : 0,
			list = [],
			p = getCachedFilename(pdfname),
			tpl = templates[template] ?? templates[DEFAULT_TPL],
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
			doc.font('Courier').fontSize(8).text(`ID: ${e._id}`, toPoint(x), toPoint(y+tpl.cellHeight)-8, { width: toPoint(tpl.cellWidth), align: 'center' } )
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
	return { templates, generate, exists, batchPrint, getBatches, getBatch, updateBatch }
}
