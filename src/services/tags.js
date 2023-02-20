import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import path from 'path'
import fs from 'fs';
import { generateKey } from 'crypto';

export function TagService(mongodb, parentLogger, config) {
	const COLLECTION = 'tags',
	TMPDIR = config.cache_dir,
	PUBLIC_PROJECTION = { projection: { _id: 1, name: 1, responseText: 1, status: 1, owner: 1, email: 1, label: 1 }},
	ALL_PROJECTION = {},
	TAGS = mongodb.collection(COLLECTION),
	logger = parentLogger.child({ service: 'Tag' });

	// TODO : job to check tags for creation in SVG and PNG


	async function get(id, projection) {
		// console.log('get', id)
		if(!id) {
			throw('Missing id');
		}
		return await TAGS.findOne({ _id: id }, projection || PUBLIC_PROJECTION);
	}
	async function enforcedUniqueId() {
		let tag = true, tagid, index=0;
		while(tag != null) {
			tagid = nanoid(6);
			index++
			tag = await get(tagid);
		}
		logger.debug(`>>> New id generated ${index} iterations`);
		return tagid;
	}
	async function create(tag) {
		tag._id = await enforcedUniqueId();
		if (!tag.status) {
			tag.status = 'active';
		}
		tag.createdAt = new Date();
		const result = await TAGS.insertOne(tag);
		if(!result.acknowledged) {
			throw('Impossible to save tag')
		}
		return await get(result.insertedId, PUBLIC_PROJECTION)
	}
	async function update(id, tag) {
		// let oldTag = await get(id, ALL_PROJECTION);
		// let newTag = {
		// 	...oldTag,
		// 	...tag,
		// 	createdAt: oldTag.createdAt,
		// 	updatedAt: new Date(),
		// 	_id: id
		// }
		// remove protected fields
		let result = await TAGS.updateOne({
			_id: id
		}, { $set: {
			...tag,
			updatedAt: new Date()
		}})
		return get(id);
	}
	// TODO Move to Code Service ?
	async function getQRCodeFile(tagId, format, refreshCache) {
		let options = {}, cacheFileName, code;
		options.type = 'svg'
		if (format == 'png') {
			options.type = 'png'
		}
		cacheFileName = path.join(TMPDIR, `/${tagId}.${options.type}`)
		if(!fs.existsSync(cacheFileName) || refreshCache) {
			let t = await generateCode(cacheFileName, tagId, options);
		} else {
			console.log('Using cache', cacheFileName);
		}
		return cacheFileName;
	}
	async function generateCode(filename, tagId, options) {
		let domain = config.SHORT_DOMAIN ?? config.DOMAIN,
			text = `https://${domain}/t/${tagId}`, physicalPath = path.join(filename);
		return new Promise((resolve, reject) => {
			if(options.type == 'png') {
				QRCode.toFile(physicalPath, text, (err) => {
					if(err) {
						console.error(err);
						reject(`Error generating Code: ${err}`)
					} else {
						resolve(filename);
					}
				})
			} else {
				options.type = 'svg';
				QRCode.toString(text, options, (err, txt) => {
					if(err) {
						reject(`Error generating Code: ${err}`)
					}
					console.log('Generated', filename, text, options, txt);
					if(options.type == 'svg') {
						//Append domain and tagId
						// let domainTag = `<text x="50%" y="1.75" dominant-baseline="middle" text-anchor="middle" font-family="Helvetica" font-size="3">${domain}</text>`
						// let tagTag = `<text x="50%" y="35.5" dominant-baseline="middle" text-anchor="middle" font-family="Courier"  font-size="3">Id: ${tagId}</text> `
						// let t = txt.replace('</svg>',`${domainTag}${tagTag}</svg>`);
						fs.writeFileSync(physicalPath, txt);
					}
					resolve(filename);
				})
			}
		});
	}
	async function findAll() {
		return TAGS.find({ status: { $not: { $eq: 'archived' } } }).toArray()
	}
	// TODO: Switch user reference to user._id instead of email
	async function findForUser(email, filter) {
		let f = filter ? filter : {}
		return TAGS.find({ ...filter, owner: email }).toArray();
	}
	async function remove(filter) {
		const deleteManyResult = await TAGS.deleteMany(filter);
		return { deleted: deleteManyResult.deletedCount };
	}
	const SCHEMA = {
		body: {
			type: 'object',
			required: ["name"],
			properties: {
				name: {
					type: 'string'
				},
				status: {
					type: "string",
					enum: ["new", "active", "lost", "found", "archived"]
				},
				responseText: {
					type: "string"
				},
				email: {
					type: "string"
				}
			}
		}
	}

	return {
		SCHEMA, get, findAll, findForUser, remove, create, update, getQRCodeFile
	}
}
