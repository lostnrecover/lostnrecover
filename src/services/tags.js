import { nanoid } from 'nanoid';
import { FINAL_STATUS as DISCOVERY_STATUS_FILTER} from './discovery.js';
import { initCollection } from '../utils/db.js';
import { EXCEPTIONS } from './exceptions.js';

export const STATUS = {
	NEW: 'new',
	ACTIVE: 'active',
	ARCHIVED: 'archived',
	LOST: 'lost'
}
export const SCHEMA = {
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
			email: {
				type: "string"
			}
		}
	}
}

export async function TagService(mongodb, parentLogger, config, USERS, INSTRUCTIONS) {
	const COLLECTION = 'tags',
	TMPDIR = config.cache_dir,
	// TAGS = mongodb.collection(COLLECTION),
	logger = parentLogger.child({ service: 'Tag' });

	let TAGS = await initCollection(mongodb, COLLECTION);
	//.then(col => TAGS = col);

	// TODO : job to check tags for creation in SVG and PNG

	async function search(filter) {
		return await TAGS.aggregate([
			{ $match: filter},
			{ $set: {
				'recipient_id': { $ifNull: ['$recipient_id', '$owner_id']} }
			},
			// Lookup owner
			{
				$lookup: {
					from: "users",
					localField: "owner_id",
					foreignField: "_id",
					as: "owner"
				}
			},
			{ $unwind : {path: "$owner", preserveNullAndEmptyArrays: true} },
			// lookup recipient
			{
				$lookup: {
					from: "users",
					localField: "recipient_id",
					foreignField: "_id",
					as: "recipient"
				}
			},
			{ $unwind : {path: "$recipient", preserveNullAndEmptyArrays: true} },
			// lokkup for instructions
			{
				$lookup: {
					from: "instructions",
					localField: "instructions_id",
					foreignField: "_id",
					as: "instructions"
				}
			},
			{ $unwind : {path: "$instructions", preserveNullAndEmptyArrays: true} },
			// Lookup for a liste of active discoveries
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
			}
		]).toArray();
	}

	async function get(id, projection) {
		let tags;
		if(!id) {
			throw('Missing id');
		}
		tags = await search({ _id: id });
		return tags[0];
	}

	async function getForUpdate(id, userid, projection) {
		let t = await get(id, projection);
		if( t.status != STATUS.new 
			&& t.owner_id != userid 
			&& t.recipient_id != userid) {
			throw EXCEPTIONS.ACTION_NOT_AUTHORISED;
		}
		return t;
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
		if (!tag.status || !Object.values(STATUS).includes(tag.status)) {
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
		if(tag.instructions) {
			delete tag.instructions;
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
		return await get(result.insertedId)
	}
	async function bulkCreate(tpl, count) {
		let tags, list = (new Array(count).fill());
		if(!(count > 0)) {
			throw EXCEPTIONS.BAD_REQUEST;
		}
		tpl.batchId = tpl.batchId ?? nanoid();
		tags = await Promise.all(list.map(async e => {
			let t = await create({...tpl});
			logger.debug(t, `Created tag in batch ${tpl.batchId}`)
			return t;
		}));
		return tags;
	}

	async function bulkSet(filter, template) {
		let updates = await TAGS.updateMany(filter, { $set: template });
		if(!updates.acknowledged) {
			throw('Error Setting bilk');
		}
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
		}});
		return get(id);
	}
	async function release(id) {
		let tag = await get(id), newTag = {...tag};
		// Release a tag for a new owner
		// move history to archived tag
		// cleanup fileds and set new status.
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
		return await search({ ...filter, $or: [{owner_id: user_id}, {recipient_id: user_id}] });
	}
	async function remove(filter) {
		const deleteManyResult = await TAGS.deleteMany(filter);
		return { deleted: deleteManyResult.deletedCount };
	}

	async function count() {
		let res = await TAGS.aggregate([{
			$group:
				{
					_id: "$status", // Group key
					count: { $count: {} }
				}
		}]);
		return res.toArray();
	}

	return {
		count, get, getForUpdate, findAll, findForUser, search, remove, create, bulkCreate, bulkSet, update, release
	}
}
