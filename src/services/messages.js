import { nanoid } from "nanoid";
import Agenda from "agenda";

let workerJob = false;

export function MessageService(mongodb, parentLogger, mailer) {
	const COLLECTION = 'messages'
	const MSG = mongodb.collection(COLLECTION);
	const retentionDays = 2;
	const logger = parentLogger.child({ service: 'Message' })

	// init agenda job
	if (!workerJob) {
		workerJob = new Agenda({ mongo: mongodb });
		workerJob.define(
			"send messages",
			{ priority: "high", concurrency: 10 },
			async (job) => {
				batchSend()
			}
		);
		workerJob.every("1 minute", "send messages");
		workerJob.start();
		logger.info('Messages Jobs started...')
	} else {
		logger.info('Messages Job already started')
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
		// TODO remove protected fields
		let result = await MSG.updateOne({
			_id: id
		}, {
			$set: {
				...fields,
				updatedAt: new Date()
			}
		})
		// TODO: Check result and eventually throw exception
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
		cursor.stream().on("data", msg => {
			send(msg._id);
			idx++
		});
		logger.info(`Sent ${idx} messages`);
	}

	async function list() {
		return await MSG.find().toArray();
	}

	return { create, get, pause, resume, send, batchSend, list }
}
