import fastify from "fastify";
import { nanoid } from "nanoid";

export function AuthTokenService(mongodb, logger) {
	const COLLECTION_NAME = 'authtokens'
	const COLLECTION = mongodb.collection(COLLECTION_NAME);
	// Check if TTL index exists
	const TTLIndexName = 'expiration TTL'
	let indexExpiration = COLLECTION.indexExists(TTLIndexName).then(exists => {
		if (!exists) {
			COLLECTION.createIndex({ "expireAt": 1 }, { name: TTLIndexName, expireAfterSeconds: 0 })
		}
	})
	function addSeconds(date, secondsOffset) {
		let d = new Date(date.valueOf());
		d.setSeconds(d.getSeconds() + secondsOffset);
		return d
	} 
	async function create(email, offset) {
		let token = {};
		token._id = nanoid();
		token.email = email;
		token.createdAt = new Date();
		token.validUntil = addSeconds(token.createdAt, (offset || 3600))
		token.expireAt = addSeconds(token.validUntil, 3600);

		const result = await COLLECTION.insertOne(token);
		if (!result.acknowledged) {
			throw (`Impossible to create token for: ${email}`)
		}
		return await result.insertedId
	}
	async function verify(tokenid) {
		try {
			let token =  await COLLECTION.findOne({ _id: tokenid.trim() });
			if(token) {
				let now = new Date()
				console.log('Compare', token, now, token.validUntil, now.getTime() < token.validUntil.getTime())
				if(now.getTime() < (token.validUntil.getTime() || 0)) {
					return token.email
				}
			}
		} catch(e) {
			logger.error('Verify Token error', e)
		}
		return false
	}
	const SCHEMA = {
		body: {
			type: 'object',
			properties: {
				email: {
					type: "string"
				},
				createdAt: {
					type: 'integer'
				},
				expireAt: {
					type: "integer"
				}
			}
		}
	}
	return { SCHEMA, create, verify }
}