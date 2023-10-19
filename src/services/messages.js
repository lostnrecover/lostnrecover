import { nanoid } from 'nanoid';
import { initCollection } from '../utils/db.js';
import { getMailer } from '../utils/mail.js';
import { EXCEPTIONS } from './exceptions.js';

const BATCHSEND = 'Messages.batchSend';

export async function MessageService(mongodb, parentLogger, config) {
	const COLLECTION = 'messages';
	// FIXME to configuration
	const retentionDays = 14;
	const logger = parentLogger.child({ service: 'Message' });
	// const MSG = mongodb.collection(COLLECTION);
	let MSG = await initCollection(mongodb, COLLECTION),
		mailer = await getMailer(config, logger);

	function registerJob(workerJob) {
		// init agenda job
		workerJob.define(
			BATCHSEND,
			{ priority: 'high', concurrency: 1},
			async () => { // (job)
				let count = await batchSend(); 
				// logger.debug(job);
				if(count > 0) {
					logger.info(`${BATCHSEND} executed: Sent ${count} messages`);
				}
			}
		);
		workerJob.enable({ name: BATCHSEND });
		workerJob.every('1 minute', BATCHSEND);
		logger.info(`${BATCHSEND} Jobs registered...`);
	}

	async function get(id) {
		if (!id) {
			throw ('Missing id');
		}
		return await MSG.findOne({ _id: id });
	}

	async function create(message, schedule) {
		let dv = new Date(schedule), sch = (dv == 'Invalid Date') ? new Date() : dv, msg = {
			...message,
			_id: nanoid(),
			createdAt: new Date(),
			schedule: sch,
			status: 'new' // new, pause, sent, error
		};
		const result = await MSG.insertOne(msg);
		if (!result.acknowledged) {
			throw ('Impossible to save message');
		}
		return await get(result.insertedId);
	}

	async function update(id, fields) {
		// FIXME remove protected fields
		let result = await MSG.updateOne({
			_id: id
		}, {
			$set: {
				...fields,
				updatedAt: new Date()
			}
		});
		if(result.modifiedCount != 1) {
			throw EXCEPTIONS.UPDATE_FAILED;
		}
		return await get(id);
	}

	async function pause(msgID) {
		let m = await get(msgID);
		if (m && m.status != 'sent') {
			return await update(msgID, { status: 'pause' });
		} else {
			return false;
		}
	}
	async function resume(msgID) {
		let m = await get(msgID);
		if (m && m.status == 'pause') {
			return await update(msgID, { status: 'new' });
		} else {
			return false;
		}
	}

	async function send(msgID) {
		// CHECK fetch user email for id
		let msg = await get(msgID), now = new Date(), expireAt = new Date();
		if (!msg || !msg.status || msg.status != 'new' || !msg.to) { // || now < msg.schedule ) {
			return false;
		}
		let res = await mailer({
			subject: msg.subject,
			template: msg.template,
			context: msg.context,
			to: msg.to,
			from: msg.from
		});
		/* Res example
		{
			accepted: [
				"seb@z720.net",
			],
			rejected: [
			],
			envelopeTime: 71,
			messageTime: 81,
			messageSize: 1637,
			response: "250 Accepted [STATUS=new MSGID=Y-DqFykOP3YSqbYuZAw7gjbzlc7YMgW8AAAAIs4eGe6SCKTQi0wAn8imGmk]",
			envelope: {
				from: "tag-sMreGDDN5s9e7eTX-cxXG@dev.lostnrecover.me",
				to: [
					"seb@z720.net",
				],
			},
			messageId: "<4fd9d2e1-ef01-efd5-04d6-a63ee1743dd4@dev.lostnrecover.me>",
		}
		*/
		logger.debug({...res, msg: 'SendMail result', msgID});
		if (!res) {
			update(msgID, { status: 'error', response: res.repsonse });
			return false;
		}
		expireAt.setDate(now.getDate() + retentionDays);
		await update(msgID, { status: 'sent', sentAt: new Date(), expireAt: expireAt, response: { id: res.messageId, response: res.response } });
		return await get(msgID);
	}

	async function batchSend() {
		const cursor = MSG.find({ status: 'new' });
		let idx = 0;
		await cursor.stream().on('data', msg => {
			send(msg._id);
			idx++;
		});
		return idx;
	}

	async function list(filter) {
		return await MSG.find(filter).sort({ createdAt: -1 }).toArray();
	}

	return { create, get, pause, resume, send, batchSend, list, registerJob };
}
