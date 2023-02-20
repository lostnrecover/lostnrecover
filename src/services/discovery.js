import { nanoid } from "nanoid";
import { EXCEPTIONS } from './exceptions.js'
import { MessageService } from "./messages.js";
import { TagService } from "./tags.js";

export function DiscoveryService(mongodb, parentLogger, config, mailer) {
	const COLLECTION = 'discovery';
	const DISCOVERY = mongodb.collection(COLLECTION);
	const logger = parentLogger.child({ service: 'Discovery'});
	const MSG = MessageService(mongodb, logger, config, mailer);
	const TAGS = TagService(mongodb, logger, config);

  // TODO Ensure Init index

	// TODO job to process discovery expiration new, closed

  async function get(id) {
		// console.log('get', id)
		if(!id) {
			throw('Missing id');
		}
		return await DISCOVERY.findOne({ _id: id });
	}

  async function create(tag, finder, owner, shareFinder) {
    let discovery = {
      _id: nanoid(),
      tagId: tag._id,
			finder, owner,
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
			sendInstructions(discovery, tag);
			sendOwnerNotification(discovery, tag)
		} else {
			setPending(discovery._id);
			sendNew(discovery, tag);
		}
		return discovery;
  }

  async function update(id, discovery) {
		// TODO remove protected fields
		let result, set = {...discovery}
		delete set.status, set.createdAt, set.updatedAt;
		result = await TAGS.updateOne({
			_id: id
		}, {
			$set: set,
			$currentDate: {
				updatedAt: true
			}
		})
    // TODO: Check result and eventually throw exception
		return await get(id);
	}

	function finderEmail(finder) {
		return finder
	}

	async function sendNew() {
		// TODO : Notify finder link to get instructions
	}

	async function sendInstructions(discovery, tag) {
		// TODO: check active session before sending an email to avoid sharing personal information
		MSG.create({
			subject: `Instructions for ${tag.name} (${tag._id})`,
			template: 'mail/instructions',
			context: { tag, email: finderEmail(discovery.finder) },
			to: email,
			// TODO : email pattern parameters
			from: `"Tag Owner <tag-${tag._id}@lnf.z720.net>`
		});
	}
	async function sendOwnerNotification(discovery, tag) {
		MSG.create({
			subject: `Tag ${tag.name} was found (${tag._id})`,
			template: 'mail/found',
			context: { tag , email: discovery.allowFinderSharing ? finderEmail(discovery.finder) : null },
			to: tag.email || tag.owner
		})
	}
	// TODO 50% move mail notification to background worker https://www.mongodb.com/basics/change-streams

		// if new: user was not logged in: propose to resubmit the dscovery
		// if pending: when tag status was not declared lost,
		//    if owner: approve the lost status of tag
		//    if finder: display info that owner has been notified
		// if active: display instructions, propose to declare return (finder) or reception (owner)
		// if closed: display status
	async function setPending(id) {
		let d = await get(id);
		if(d.status != 'new') {
			return false;
		}
		d.status = 'pending';
		await update(id, d);
		return true
	}
	async function activate(id) {
		let d = await get(id);
		if(d.status != 'new' && d.status != 'pending') {
			return false;
		}
		d.status = 'active';
		await update(id, d);
		return true
	}

	async function flagReturned(id) {
		let d = await get(id);
		if(d.status != 'active') {
			return false;
		}
		d.status = 'returned';
		await update(id, d);
		return true
	}
	async function close(id) {
		let d = await get(id);
		if(d.status != 'active' && d.status != 'returned') {
			return false;
		}
		d.status = 'closed';
		await update(id, d);
		return true
	}

  return { create, get, update, setPending, activate, flagReturned, close }
}
