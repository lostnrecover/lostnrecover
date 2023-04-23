import { nanoid } from "nanoid";
import { EXCEPTIONS } from './exceptions.js'
import { MessageService } from "./messages.js";
import { TagService } from "./tags.js";
import { UserService } from "./user.js";
import { STATUS as TAG_STATUS } from "./tags.js";
import { initCollection } from "../utils/db.js";

export const STATUS = {
	PENDING: 'pending',
	NEW: 'new',
	ACTIVE: 'active',
	RETURNED: 'returned',
	RECOVERED: 'recovered',
	REJECTED: 'rejected'
}

export const FINAL_STATUS= [ STATUS.RECOVERED, STATUS.REJECTED ]

export async function DiscoveryService(mongodb, parentLogger, config, mailer) {
	const COLLECTION = 'discovery';
	// const DISCOVERY = mongodb.collection(COLLECTION);
	const logger = parentLogger.child({ service: 'Discovery'});
	const MSG = await MessageService(mongodb, logger, config, mailer);
	const TAGS = await TagService(mongodb, logger, config);
	const USERS = await UserService(mongodb, logger, config);
	let DISCOVERY = await initCollection(mongodb, COLLECTION);
	//.then(col => DISCOVERY = col);
	// TODO job to process discovery expiration new, closed
  // TODO Ensure Init index if any

	async function search(filter) {
		return await DISCOVERY.aggregate(
      [
        {
          '$match': filter
        }, {
          '$lookup': {
            'from': 'users', 
            'localField': 'finder_id', 
            'foreignField': '_id', 
            'as': 'finder'
          }
        }, {
          '$unwind': {
            'path': '$finder', 
            'preserveNullAndEmptyArrays': true
          }
        }, {
          '$lookup': {
            'from': 'tags', 
            'localField': 'tagId', 
            'foreignField': '_id', 
            'as': 'tag'
          }
        }, {
          '$unwind': {
            'path': '$tag', 
            'preserveNullAndEmptyArrays': true
          }
        }, {
          '$addFields': {
            'instructions_id': '$tag.instructions_id'
          }
        }, {
          '$lookup': {
            'from': 'instructions', 
            'localField': 'instructions_id', 
            'foreignField': '_id', 
            'as': 'instructions'
          }
        }, {
          '$unwind': {
            'path': '$instructions', 
            'preserveNullAndEmptyArrays': true
          }
        }
      ]
		).toArray();
	}

  async function get(id) {
		if(!id) {
			throw('Missing id');
		}
		// CHECK aggregate Tag and users ?
		let d = await search({ _id: id });
		return d[0];
	}

  async function create(tag, finder_id, owner_id, shareFinder) {
    let discovery = {
      _id: nanoid(),
      tagId: tag._id,
			finder_id, owner_id,
			allowFinderSharing: !!shareFinder,
      createdAt: new Date(),
      status: 'new'
    };
    if(!tag) {
      throw EXCEPTIONS.MISSING_TAG;
    }
		const result = await DISCOVERY.insertOne(discovery);
		if(!result.acknowledged) {
			throw('Impossible to save discovery')
		}
		discovery = await get(result.insertedId);
		if(tag.status == 'lost') {
			activate(discovery._id);
		} else {
			setPending(discovery._id);
			sendNew(discovery);
		}
		return discovery;
  }

  async function update(id, discovery) {
		// TODO remove protected fields
		let result, set = {...discovery}
		delete set._id, set.status, set.createdAt, set.updatedAt;
		logger.debug('Discovery Update set', set);
		result = await DISCOVERY.updateOne({
			_id: id
		}, {
			// $currentDate: {
			// 	updatedAt: true
			// },
			$set: set
		})
    // TODO: Check result and eventually throw exception
		return await get(id);
	}

	async function finderEmail(finder) {
		return finder.email
	}
	async function discoverySender(discovery) {
		return `${config.appName} <tag-${discovery._id}@${config.DOMAIN}>`;
	}
	async function recipientEmail(discovery) {
		let id = discovery.tag.recipient_id, r;
		if(!id) {
			id = discovery.tag.owner_id;
		}
		r = await USERS.findById(id);
		return r.email;
	}

	async function sendNew(discovery) {
		// FIXME : Notify owner to release instructions
		sendOwnerNotification(discovery);
	}

	async function sendInstructions(discovery) {
		// TODO: check active session before sending an email to avoid sharing personal information
		MSG.create({
			subject: `Instructions for ${discovery.tag.name} (${discovery.tag._id})`,
			template: 'mail/instructions',
			context: { discovery, email: await finderEmail(discovery.finder) },
			// CHECK should be an id
			to: await finderEmail(discovery.finder),
			// CHECK should be an id or ?
			// TODO : email pattern parameters
			from: await discoverySender(discovery)
		});
	}
	async function sendOwnerNotification(discovery) {
		// CHECK [X] : should be id
		let recipient = await recipientEmail(discovery); //tag.recipient_id || tag.owner_id
		MSG.create({
			subject: `Tag ${discovery.tag.name} was found (${discovery.tag._id})`,
			template: 'mail/found',
			context: { tag: discovery.tag ,
					email: discovery.allowFinderSharing ? await finderEmail(discovery.finder) : null },
			to: recipient,
			from: await discoverySender(discovery)
		})
	}
	// TODO 50% move mail notification to background worker https://www.mongodb.com/basics/change-streams

	// if new: user was not logged in: propose to resubmit the dscovery
		// if pending: when tag status was not declared lost,
		//    if owner: approve the lost status of tag
		//    if finder: display info that owner has been notified
		// if active: display instructions, propose to declare return (finder) or reception (owner)
		// if closed: display status
	async function setStatus(id, status) {
		let result = await DISCOVERY.updateOne({
			_id: id
		}, {
			$set: { status: status },
			$push: { states: {
				status: status,
				updatedAt: new Date()
			}}
		});
		return (result.modifiedCount == 1)
	}

	async function setPending(id) {
		let d = await get(id);
		if(d.status != STATUS.NEW) {
			return false;
		}
		return setStatus(id, STATUS.PENDING);
	}
	async function activate(id) {
		let d = await get(id);
		if(d.status != STATUS.NEW && d.status != STATUS.PENDING) {
			return false;
		}
		sendInstructions(d);
		sendOwnerNotification(d);
		TAGS.update(d.tagId, { status: TAG_STATUS.LOST })
		return setStatus(id, STATUS.ACTIVE);
	}

	async function reject(id) {
		let d = await get(id);
		if(d.status != STATUS.NEW && d.status != STATUS.PENDING) {
			return false;
		}
		TAGS.update(d.tagId, { status: TAG_STATUS.ACTIVE })
		return setStatus(id, STATUS.REJECTED);
	}

	async function flagReturned(id) {
		let d = await get(id);
		if(d.status != STATUS.ACTIVE) {
			return false;
		}
		return setStatus(id, STATUS.RETURNED);
	}

	async function close(id) {
		let d = await get(id);
		if(d.status != STATUS.ACTIVE && d.status != STATUS.RETURNED) {
			return false;
		}
		return setStatus(id, STATUS.RECOVERED);
	}

  return { create, get, update, setPending, activate, flagReturned, close, reject }
}
