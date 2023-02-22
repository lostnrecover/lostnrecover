import { nanoid } from "nanoid";
import { EXCEPTIONS } from './exceptions.js'


// TODO: Manage a user account collection for future anonymization:
// an email is link to a user account (nanoid) and the account id should be used for relation
// anonymization may be obtained by removing the email address from the user account
// tobe done only if all tags are archived first
// NB: only fully works if contact email is removed from tag when its archived


export function AuthTokenService(mongodb, parentLogger) {
	const COLLECTION_NAME = 'authtokens'
	const COLLECTION = mongodb.collection(COLLECTION_NAME);
	// Check if TTL index exists
	const TTLIndexName = 'expiration TTL';
	const logger = parentLogger.child({ service: 'AuthToken'})
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
	async function newToken(email, type, offset) {
		let token = {};
		token._id = nanoid();
		token.email = email;
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
				// console.log('Compare', token, now, token.validUntil, now.getTime() < token.validUntil.getTime())
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
		let email = request.session.get('email');
		if (!email) {
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
	return { SCHEMA, create, verify, authentified }
}
