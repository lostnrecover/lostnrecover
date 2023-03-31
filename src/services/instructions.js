import { nanoid } from 'nanoid';
import { initCollection } from '../utils/db.js';
import { EXCEPTIONS } from './exceptions.js';

export async function InstructionsService(mongodb, parentLogger, config) {
	const COLLECTION = 'instructions',
	logger = parentLogger.child({ service: 'Instruction' });

	let INSTRUCTIONS = await initCollection(mongodb, COLLECTION);

	async function search(filter) {
		let res = await INSTRUCTIONS.aggregate([
			{ $match: filter},
			{
				$lookup: {
					from: "users",
					localField: "owner_id",
					foreignField: "_id",
					as: "owner"
				}
			},
			{ $unwind : {path: "$owner", preserveNullAndEmptyArrays: true} },
			{
				$lookup: {
					from: "tags",
					localField: "_id",
					foreignField: "instructions_id",
					as: "tags"
				}
			}, 
			{ $addFields: {
					isDefault: {
						$eq: [ "$_id", "$owner.defaultInstructions"]
					}
				}
			}
		]);
		let arr = await res.toArray();
		return arr;
	}

	async function get(id) {
		let instructions;
		if(!id) {
			throw('Missing id');
		}
		instructions = await search({ _id: id });
		return instructions[0];
	}

	async function getForUpdate(id, userid, projection) {
		let instr = await get(id, projection);
		if( instr.owner_id != userid ) {
			throw EXCEPTIONS.ACTION_NOT_AUTHORISED;
		}
		return instr;
	}

	async function cleanup(instructions) {
		// FIXME add instructions schema compliance cleanup.
		// if (!instructions.status || !Object.values(STATUS).includes(instructions.status)) {
		// 	instructions.status = STATUS.NEW;
		// }
		if(instructions.owner) {
			delete instructions.owner;
		}
		if(instructions.tags) {
			delete instructions.tags;
		}
		delete instructions.isDefault;
		return instructions;
	}

	// TODO bulk create if parameter is an array
	async function create(instructionsInput) {
		let instructions = await cleanup(instructionsInput),
			defs = await search({
				owner_id: instructions.owner_id
			});
		instructions._id = nanoid();
		instructions.createdAt = new Date();
		// Get current default value
		if (defs.length == 0) {
			// TODO LNR-22 : First should be saved as default
			// Update user ?
		}
		const result = await INSTRUCTIONS.insertOne(instructions);
		if(!result.acknowledged) {
			throw('Impossible to save instructions')
		}
		return await get(result.insertedId)
	}
	// TODO Status history like Discovery
	async function update(id, instrInput) {
		// remove protected fields
		let instructions = await cleanup(instrInput);
		let result = await INSTRUCTIONS.updateOne({
			_id: id
		}, { $set: {
			...instructions,
			updatedAt: new Date()
		}});
		return get(id);
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
		const deleteManyResult = await INSTRUCTIONS.deleteMany(filter);
		return { deleted: deleteManyResult.deletedCount };
	}

	async function count() {
		let res = await INSTRUCTIONS.aggregate([{
			$group:
				{
					_id: "$status", // Group key
					count: { $count: {} }
				}
		}]);
		return res.toArray();
	}

	const SCHEMA = {
		body: {
			type: 'object',
			required: ["name"],
			properties: {
				name: {
					type: 'string'
				},
				body: {
					type: "string"
				},
				owner_id: {
					type: "string"
				},
				isDefault: {
					type: "boolean"
				},
				tags: {
					type: 'array'
				}
			}
		}
	}
	return {
		SCHEMA, count, get, getForUpdate, findForUser, remove, create, update
	}
}
