import { nanoid } from "nanoid";
import { EXCEPTIONS } from './exceptions.js'

export function DiscoveryService(mongodb, parentLogger) {
	const COLLECTION = 'discovery'
	const DISCOVERY = mongodb.collection(COLLECTION);
	const logger = parentLogger.child({ service: 'Discovery'})
  // TODO Ensure Init index on tags ?

  async function get(id) {
		// console.log('get', id)
		if(!id) {
			throw('Missing id');
		}
		return await DISCOVERY.findOne({ _id: id });
	}

  async function create(tagId, finder, owner) {
    let discovery = {
      _id: nanoid(),
      tagId, finder, owner,
      createdAt: new Date(),
      status: 'new'
    };
    if(!discovery.tagId) {
      throw EXCEPTIONS.MISSING_TAG;
    }
		const result = await DISCOVERY.insertOne(discovery);
		if(!result.acknowledged) {
			throw('Impossible to save discovery')
		}
		return await get(result.insertedId)
  }

  async function update(id, discovery) {
		// TODO remove protected fields
		let result = await TAGS.updateOne({
			_id: id
		}, {
			$set: {
				...discovery
			},
			$currentDate: {
				updatedAt: true
			}
		})
    // TODO: Check result and eventually throw exception
		return await get(id);
	}

  return { create, get, update }
}
