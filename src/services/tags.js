import { nanoid } from 'nanoid';
export function TagService(mongodb) {
	const COLLECTION = ' tags'
	const PUBLIC_PROJECTION = { _id: 1, name: 1, page: 1, status: 1 }
	const TAGS = mongodb.collection(COLLECTION);

	async function get(id, projection) {
		return TAGS.findOne({ id }, { projection: projection || PUBLIC_PROJECTION });
	}
	async function create(tag) {
		tag._id = nanoid();
		if (!tag.status) {
			tag.status = 'active';
		}
		tag.createdAt = Date.now();
		const result = await TAGS.insertOne(tag);
		console.log(result)
		if(!result.acknowledged) {
			throw('Impossible to save tag')
		}
		return await get(result.insertedId, PUBLIC_PROJECTION)
	}
	async function findAll() {
		return TAGS.find({ status: { $not: { $eq: 'archived' } } }).toArray()
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
					enum: ["new", "active", "lost", "archived"]
				},
				replyTo: {
					type: "string"
				},
				replyWith: {
					type: "string"
				}
			}
		}
	}

	return {
		SCHEMA, get, findAll, remove, create
	}
}