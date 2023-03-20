import { nanoid } from "nanoid";
import { initCollection } from "../utils/db.js";
import { EXCEPTIONS } from './exceptions.js'


export async function AuthTokenService(mongodb, parentLogger) {
	const COLLECTION_NAME = 'authtokens'
	// Check if TTL index exists
	const TTLIndexName = 'expiration TTL';
	const logger = parentLogger.child({ service: 'AuthToken'})
	let COLLECTION = await initCollection(mongodb, COLLECTION_NAME, [
		{ options: { name: TTLIndexName, expireAfterSeconds: 0 }, spec: { "expireAt": 1 }}
	])
	// .then(col => COLLECTION = col);
	function addSeconds(date, secondsOffset) {
		let d = new Date(date.valueOf());
		d.setSeconds(d.getSeconds() + secondsOffset);
		return d
	}
	async function newToken(email, type, offset) {
		let token = {};
		token._id = nanoid();
		token.email= email;
		token.type = type
		token.createdAt = new Date();
		token.validUntil = addSeconds(token.createdAt, (offset || 3600))
		token.expireAt = addSeconds(token.validUntil, 3600);

		const result = await COLLECTION.insertOne(token);
		if (!result.acknowledged) {
			throw (`Impossible to create token for: ${email}`)
		}
		return await result.insertedId
	}
	async function create(email, offset) {
		return newToken(email, 'session', offset)
	}
	async function verify(tokenid) {
		try {
			let token =  await COLLECTION.findOne({ _id: tokenid.trim() });
			if(token) {
				let now = new Date()
				if(now.getTime() < (token.validUntil.getTime() || 0)) {
					return token.email
				}
			}
		} catch(e) {
			logger.error('Verify Token error', e)
		}
		return false
	}
	async function authentified(request, reply) {
		let id = request.session.get('user_id');
		if (!id) {
			throw(EXCEPTIONS.NOT_AUTHORISED);
		}
	}
	async function isAdmin(request, reply) {
		let isAdmin = request.session.get('isAdmin');
		if(process.env.ENV != 'dev' && !isAdmin) {
			throw(EXCEPTIONS.NOT_AUTHORISED);
		}
	}
	const SCHEMA = {
		body: {
			type: 'object',
			properties: {
				email: {
					type: "string"
				},
				createdAt: {
					type: 'integer' //date ?
				},
				expireAt: {
					type: "integer" //date ?
				}
			}
		}
	}
	return { SCHEMA, create, verify, authentified, isAdmin }
}
