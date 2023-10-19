import { nanoid } from 'nanoid';
import { initCollection } from '../utils/db.js';
import { EXCEPTIONS } from './exceptions.js';

export const SCHEMA = {
	body: {
		type: 'object',
		required: ['name'],
		properties: {
			name: {
				type: 'string'
			},
			body: {
				type: 'string'
			},
			owner_id: {
				type: 'string'
			},
			isDefault: {
				type: 'boolean'
			},
			tags: {
				type: 'array'
			}
		}
	}
};

export async function InstructionsService(mongodb, parentLogger, config, USERS) {
	const COLLECTION = 'instructions',
		logger = parentLogger.child({ service: 'Instruction' });

	let INSTRUCTIONS = await initCollection(mongodb, COLLECTION);

	async function search(filter) {
		let res = await INSTRUCTIONS.aggregate([
			{ $match: filter},
			{
				$lookup: {
					from: 'users',
					localField: 'owner_id',
					foreignField: '_id',
					as: 'owner'
				}
			},
			{ $unwind : {path: '$owner', preserveNullAndEmptyArrays: true} },
			{
				$lookup: {
					from: 'tags',
					localField: '_id',
					foreignField: 'instructions_id',
					as: 'tags'
				}
			}, 
			{ $addFields: {
				isDefault: {
					$eq: [ '$_id', '$owner.defaultInstructions']
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

	async function saveAsUserDefaultIfFirst(user_id, instructions_id) {
		let list = await findForUser(user_id);
		if(list && list.length < 2) {
			USERS.update(user_id, { defaultInstructions: instructions_id }).catch(e => {
				logger.error({error: e}, 'Failed to set default Instructions');
			});
		}
	}

	// TODO bulk create if parameter is an array
	async function create(instructionsInput) {
		let instructions = await cleanup(instructionsInput);
		instructions._id = nanoid();
		instructions.createdAt = new Date();
		const result = await INSTRUCTIONS.insertOne(instructions);
		if(!result.acknowledged) {
			throw('Impossible to save instructions');
		}
		saveAsUserDefaultIfFirst(instructions.owner_id, instructions._id);
		return await get(result.insertedId);
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
		if(result.modifiedCount != 1) {
			throw EXCEPTIONS.UPDATE_FAILED;
		}
		return get(id);
	}

	// done: TODO: Switch user reference to user._id instead of email
	async function findForUser(user_id, filter) {
		let f = filter ? filter : {};
		if(!user_id) {
			return null;
		}
		return await search({ ...f, owner_id: user_id });
	}

	async function remove(filter) {
		const deleteManyResult = await INSTRUCTIONS.deleteMany(filter);
		return { deleted: deleteManyResult.deletedCount };
	}

	async function count() {
		let res = await INSTRUCTIONS.aggregate([{
			$group:
				{
					_id: '$status', // Group key
					count: { $count: {} }
				}
		}]);
		return res.toArray();
	}

	return {
		count, get, getForUpdate, findForUser, remove, create, update
	};
}
