import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import path from 'path'
import fs from 'fs';
import { UserService } from './user.js';
import { FINAL_STATUS as DISCOVERY_STATUS_FILTER} from './discovery.js';

export const STATUS = {
	NEW: 'new',
	ACTIVE: 'active',
	ARCHIVED: 'archived',
	LOST: 'lost'
}

export function TagService(mongodb, parentLogger, config) {
	const COLLECTION = 'tags',
	TMPDIR = config.cache_dir,
	PUBLIC_PROJECTION = { projection: { _id: 1, name: 1, responseText: 1, status: 1, owner: 1, email: 1, label: 1 }},
	ALL_PROJECTION = {},
	TAGS = mongodb.collection(COLLECTION),
	logger = parentLogger.child({ service: 'Tag' }),
	USERS = UserService(mongodb, logger, config);

	// TODO : job to check tags for creation in SVG and PNG

	async function search(filter) {
		return await TAGS.aggregate([
			{ $match: filter},
			{ $set: {
				'recipient_id': { $ifNull: ['$recipient_id', '$owner_id']} }
			},
			{
				$lookup: {
					from: "users",
					localField: "owner_id",
					foreignField: "_id",
					as: "owner"
				}
			},
			{ $unwind : "$owner" },
			// {$set:{fruit_name:{$ifNull:["$fruit_name",  ]}}}
			{
				$lookup: {
					from: "users",
					localField: "recipient_id",
					foreignField: "_id",
					as: "recipient"
				}
			},
			{
				$lookup: {
					from: "discovery",
					localField: "_id",
					foreignField: "tagId",
					// let: { id: "$_id" },
					pipeline: [
						{ $match:
							{ $expr:
									{ $not: [
										{$in: ["$status", DISCOVERY_STATUS_FILTER ]}
									]}
							}
						}
					],
					as: "discoveries"
				}
			},
			{ $unwind : "$recipient" }
		]).toArray();
	}

	async function get(id, projection) {
		let tags;
		if(!id) {
			throw('Missing id');
		}
		// return await TAGS.findOne({ _id: id }, projection || PUBLIC_PROJECTION);
		tags = await search({ _id: id });
		return tags[0];
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

	async function cleanup(tag) {
		// FIXME add tag schema compliance cleanup.
		if (!tag.status) {
			tag.status = STATUS.NEW;
		}
		if(tag.owner) {
			delete tag.owner;
		}
		if(tag.recipient) {
			delete tag.recipient;
		}
		if(tag.email) {
			delete tag.email
		}
		return tag;
	}

	// TODO bulk create if parameter is an array
	async function create(tagInput) {
		let tag = await cleanup(tagInput);
		tag._id = await enforcedUniqueId();
		tag.createdAt = new Date();
		const result = await TAGS.insertOne(tag);
		if(!result.acknowledged) {
			throw('Impossible to save tag')
		}
		return await get(result.insertedId, PUBLIC_PROJECTION)
	}
	// TODO Status history like Discovery
	async function update(id, t) {
		let tag = await cleanup(t);
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
	// FIXME Move to Code Service ?
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
			logger.info(`using cache file ${cacheFileName}`);
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
					logger.child({filename, text, options, txt}).info('Generated')
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
		return await search({ status: { $not: { $eq: STATUS.ARCHIVED } } });
	}
	// done: TODO: Switch user reference to user._id instead of email
	async function findForUser(user_id, filter) {
		let f = filter ? filter : {}
		if(!user_id) {
			return null
		}
		return await search({ ...filter, owner_id: user_id });
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
