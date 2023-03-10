import { nanoid } from "nanoid";
import { initCollection } from "../utils/db.js";

const BATCHSEND = 'Messages.batchSend'

export async function MessageService(mongodb, parentLogger, config, mailer) {
	const COLLECTION = 'messages'
	// FIXME to configuration
	const retentionDays = 14;
	const logger = parentLogger.child({ service: 'Message' })
	// const MSG = mongodb.collection(COLLECTION);
	let MSG = await initCollection(mongodb, COLLECTION);
	if(!mailer) {
		throw('Mailer is required');
	}

	function registerJob(workerJob) {
		// init agenda job
		workerJob.define(
			BATCHSEND,
			{ priority: "high", concurrency: 10 },
			async (job) => {
				let count = batchSend().then((count) => {
					logger.info(`${BATCHSEND} executed: Sent ${count} messages`);
				});
			}
		);
		workerJob.every("1 minute", BATCHSEND);
		logger.info(`${BATCHSEND} Jobs registered...`)
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
			throw ('Impossible to save message')
		}
		return await get(result.insertedId)
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
		})
		// FIXME: Check result and eventually throw exception
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
		if (msg.status != 'new' || !msg.to) { // || now < msg.schedule ) {
			return false;
		}
		let res = await mailer({
			subject: msg.subject,
			template: msg.template,
			context: msg.context,
			to: msg.to,
			from: msg.from
		});
		if (!res) {
			update(msgID, { status: 'error' });
			return false;
		}
		expireAt.setDate(now.getDate() + retentionDays)
		update(msgID, { status: 'sent', sentAt: new Date(), expireAt: expireAt });
		return true;
	}

	async function batchSend() {
		const cursor = MSG.find({ status: 'new' });
		let idx = 0;
		await cursor.stream().on("data", msg => {
			send(msg._id);
			idx++
		});
		return idx;
	}

	async function list() {
		return await MSG.find().toArray();
	}

	return { create, get, pause, resume, send, batchSend, list, registerJob }
}
