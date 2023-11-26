import { nanoid } from 'nanoid';
import { EXCEPTIONS } from './exceptions.js';
import { initCollection } from '../utils/db.js';
import { STATUS as TAGS_STATUS } from './tags.js';
import { checkImapInbox, extractTagId } from '../utils/imap.js';

export const STATUS = {
	PENDING: 'pending',
	NEW: 'new',
	ACTIVE: 'active',
	RETURNED: 'returned',
	RECOVERED: 'recovered',
	REJECTED: 'rejected'
};

export const FINAL_STATUS= [ STATUS.RECOVERED, STATUS.REJECTED ];

const BATCHIMAP = 'Messages.readInbox';

let isRunning = false;

export async function DiscoveryService(mongodb, parentLogger, config, MSG, TAGS, USERS) {
	const COLLECTION = 'discovery';
	// const DISCOVERY = mongodb.collection(COLLECTION);
	const logger = parentLogger.child({ service: 'Discovery'});
	let DISCOVERY = await initCollection(mongodb, COLLECTION);
	//.then(col => DISCOVERY = col);
	// TODO job to process discovery expiration new, closed
	// TODO Ensure Init index if any

	async function registerJob(workerJob) {
		let jobLogger = logger.child({'job': BATCHIMAP});
		// init agenda job
		workerJob.define(
			BATCHIMAP,
			{ priority: 'high', concurrency: 1},
			async (job) => {
				if (isRunning) {
					job.fail('Still running');
					job.save();
					return false;
				}
				isRunning = true;
				try {
					jobLogger.info('READ IMAP INBOX');
					await checkImapInbox(jobLogger, processEmail);
				} catch(e) {
					job.fail(e);
				} finally {
					isRunning = false;
				}
			}
		);
		workerJob.enable({ name: BATCHIMAP });
		workerJob.every('5 minutes', BATCHIMAP);
		jobLogger.info(`${BATCHIMAP} Jobs registered...`);
	}


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

	async function findForFinder(tag, finder) {
		let disc = await search({
			tagId: tag._id,
			finder_id: finder._id
		});
		if(disc.length > 0) {
			return disc[0];
		}
		return false;
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
			throw('Impossible to save discovery');
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
		let result, set = {...discovery};
		delete set._id, set.status, set.createdAt, set.updatedAt;
		logger.debug('Discovery Update set', set);
		result = await DISCOVERY.updateOne({
			_id: id
		}, {
			// $currentDate: {
			// 	updatedAt: true
			// },
			$set: set
		});
		if(result.modifiedCount != 1) {
			throw EXCEPTIONS.UPDATE_FAILED;
		}
		return await get(id);
	}

	async function finderEmail(finder) {
		return finder.email;
	}
	async function discoverySender(discovery) {
		let email = config.tag_email.replace('{ID}', discovery._id);
		return `${config.appName} <${email}>`;
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
			context: { discovery: discovery ,
				email: discovery.allowFinderSharing ? await finderEmail(discovery.finder) : null },
			to: recipient,
			from: await discoverySender(discovery)
		});
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
		return (result.modifiedCount == 1);
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
		TAGS.update(d.tagId, { status: TAGS_STATUS.LOST });
		return setStatus(id, STATUS.ACTIVE);
	}

	async function reject(id) {
		let d = await get(id);
		if(d.status != STATUS.NEW && d.status != STATUS.PENDING) {
			return false;
		}
		TAGS.update(d.tagId, { status: TAGS_STATUS.ACTIVE });
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

	async function listForFinder(user_id) {
		return await search({
			finder_id: user_id
		});
	}

	async function processEmail(message) {
		try {
			let 
				sender_email = message?.from?.value[0]?.address ?? null,
				sender = await USERS.findOrFail(sender_email),
				id = extractTagId(message),
				discovery = id ? await get(id) : null, 
				ids = [],
				recipient,
				result,
				internal= {
					content: message.filteredText || message.text,
					subject: message.subject,
					id: message.messageId ,
					createdAt: new Date(),
					sentAt: new Date(message.date)
				};
			if(!discovery) {
				return false;
			}
			// check no duplicate
			ids = discovery.messages.map(m => m.id).filter(id => id ? id == message.messageId : false);
			if(ids.length > 0) {
				logger.info({msg : 'duplicate message', discId: discovery._id, messId: message.messageId});
				return false;
			}
			// check sender is owner or finder
			if(discovery.finder_id == sender._id) {
				internal.from = 'finder';
				internal.to = 'owner';
				internal.toSend = !discovery.muttedByOwner;
				recipient = discovery.finder.email;
			} else if(discovery.owner_id == sender._id) {
				internal.to = 'finder';
				internal.owner = 'owner';
				internal.toSend != !discovery.muttedByFinder;
				recipient = discovery.owner.email;
			} else {
				// Third party message: dropped
				throw(new Error(`Unknown Sender: ${sender_email}`));
			}
			// check discovery is "pending"
			if(discovery.status != STATUS.ACTIVE && discovery.status != STATUS.RETURNED) {
				// dropped : not in status
				throw(new Error(`Rejected message: ${discovery.status}`));
			}
			result = await DISCOVERY.updateOne(
				{_id: discovery._id},
				{ $push: 
					{ 'messages': internal }
				});
			if(result.modifiedCount != 1) {
				logger.error('Unexpected update error on message');
				return false;
			}
			if(internal.toSend) {
				MSG.create({
					to: recipient,
					from: discoverySender(discovery._id),
					subject: 'About tag recovery ' + discovery.tag._id,
					template: 'mail/discovery_message',
					context: { message: internal, discovery },
				});
			}
			return true;
		} catch(error) {
			logger.warn({msg: 'not a a valid message', error});
			return false;
		}
	}

	return { registerJob, create, get, update, setPending, activate, flagReturned, close, reject, findForFinder, listForFinder, processEmail };
}
