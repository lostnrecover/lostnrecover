
import { nanoid } from "nanoid";
import { initCollection } from "../utils/db.js";


export async function StatusService(mongodb, parentLogger, config, USERS, TAGS) {
	const COLLECTION_NAME = 'status',
		// COLLECTION = await mongodb.createCollection(COLLECTION_NAME),
		// Check if TTL index exists
		TTLIndexName = 'expiration TTL',
		logger = parentLogger.child({ service: 'Status'});
	let COLLECTION = await initCollection(mongodb, COLLECTION_NAME, [
		{ options: { name: TTLIndexName, expireAfterSeconds: 0 }, spec: { "expireAt": 1 } }
	]);

	function addMonths(date, monthsOffset) {
		let d = new Date(date.valueOf());
		d.setMonth(d.getMonth() + monthsOffset);
		return d;
	}
	async function check(reason) {
		let now = new Date(), expireIn6Months = addMonths(now, 6),
		uc = await USERS.count(),
		tc = await TAGS.count(),
		status = {
			_id: nanoid(),
			runAt: now,
			expireAt: expireIn6Months,
			reason,
			userCount: uc,
			tagCount: tc
		}
		logger.info(status)
		COLLECTION.insertOne(status);
		return status;
	}
	return { check }
}
