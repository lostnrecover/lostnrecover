import { nanoid } from 'nanoid';
import { initCollection } from '../utils/db.js';
import { EXCEPTIONS } from './exceptions.js';


export async function AuthTokenService(mongodb, parentLogger, config) {
	const COLLECTION_NAME = 'authtokens',
		// Check if TTL index exists
		TTLIndexName = 'expiration TTL',
		DEFAULT_AUTH_EXPIRATION = 3600 / 2, // 30 minutes
		DEFAULT_SESSION_EXPIRATION = 3600 * 24 * 30 * 3, // 3 mois
		DEFAULT_RETENTION = 3600, // 1 hour debug grace period
		logger = parentLogger.child({ service: 'AuthToken'});


	let COLLECTION = await initCollection(mongodb, COLLECTION_NAME, [
		{ options: { name: TTLIndexName, expireAfterSeconds: 0 }, spec: { 'expireAt': 1 }},
		{ options: { name: 'email' }, spec: { email: 1 } }
	]);
	// .then(col => COLLECTION = col);
	function addSeconds(date, secondsOffset) {
		let d = new Date(date.valueOf());
		d.setSeconds(d.getSeconds() + secondsOffset);
		return d;
	}
	async function newToken(email, type, offset, data) {
		let token = {};
		token._id = nanoid();
		token.email= email;
		token.type = type;
		if(data!= undefined) {
			token.data = data;
		}
		token.createdAt = new Date();
		token.validUntil = addSeconds(token.createdAt, offset);
		token.expireAt = addSeconds(token.validUntil, DEFAULT_RETENTION); // expire 1 hour after end of validity (grace debug period)
		if(!email || email == '') {
			throw(EXCEPTIONS.BAD_REQUEST);
		}
		const result = await COLLECTION.insertOne(token);
		if (!result.acknowledged) {
			throw (`Impossible to create token for: ${email}`);
		}
		return await result.insertedId;
	}
	async function createAuth(email) {
		return newToken(email, 'auth', (config.tokenValidity || DEFAULT_AUTH_EXPIRATION));
	}
	async function createSession(user, request) {
		let sessionToken = await newToken(user.email, 'session', (config.sessionValidity || DEFAULT_SESSION_EXPIRATION));
		request.session.set('sessionToken', sessionToken);
		updateSession(request);
	}

	async function updateSession(request, data) {
		let now = new Date(),
			expiration = {
				lastAccess: now,
				lastUserAgent: request.headers['user-agent'],
				lastIp: request.ip,
				validUntil: addSeconds(now, (config.sessionValidity || DEFAULT_SESSION_EXPIRATION)),
				expireAt: addSeconds(now, (config.sessionValidity || DEFAULT_SESSION_EXPIRATION) + DEFAULT_RETENTION)
			},
			set  = { ...expiration };
		if(data !== undefined) {
			set.data = data;
		}
		// update in DB
		return await COLLECTION.findOneAndUpdate(
			{ _id: request.session.get('sessionToken') },
			{ $set: set }
		);
	}

	async function getSession(request) {
		// join user
		let sessions = await COLLECTION.aggregate([
			{ $match: { $and: [ 
				{ '_id': { $eq: request.session.get('sessionToken') } },
				{ 'type': { $eq: 'session'} },
				{ 'validUntil': { $gte: new Date() } }
			]}
			},
			// { _id: request.session.get('sessionToken'), type: "session"} },
			{ $lookup: {
				from: 'users',
				localField: 'email',
				foreignField: 'email',
				as: 'user'
			}
			},
			{ $unwind: {
				path: '$user', 
				preserveNullAndEmptyArrays: true
			}
			}
		]).toArray();
		request.serverSession = null;
		if(sessions.length == 1) {
			request.serverSession = sessions[0];
			updateSession(request);
		}
		return request.serverSession;
	}

	async function deleteCurrentSession(request) {
		let session = await getSession(request);
		await deleteSession(session._id, session.email);
		request.session.delete();
		request.serverSession = null;
	}

	async function deleteSession(sessionId, email) {
		let now = new Date(),
			expiration = {
				validUntil: addSeconds(now, -5),
				expireAt: addSeconds(now, DEFAULT_RETENTION)
			};
		await COLLECTION.findOneAndUpdate(
			{ _id: sessionId, email: email},
			{ $set: expiration }
		);
	}

	async function verify(tokenid) {
		try {
			let token =  await COLLECTION.findOne({ _id: tokenid.trim() });
			if(token) {
				let now = new Date(), 
					validity = (typeof token.validUntil.getTime === 'function') ? token.validUntil : new Date(token.validUntil);
				if(now.getTime() < (validity.getTime() || 0)) {
					return token.email;
				}
				throw(`Token invalid ${token.validUntil}`);
			}
		} catch(e) {
			logger.error({msg: 'Verify Token error', e});
		}
		return false;
	}
	// TODO move decorator ?
	async function authentified(request) {
		let id = request.serverSession?.user?._id;
		return !!id;
	}

	async function isAdmin(request) {
		let isAdmin = request.serverSession?.user?.isAdmin ?? false;
		if(process.env.ENV?.toLowerCase() == 'dev') {
			isAdmin = true;
		}
		return isAdmin;
	}
	return { createAuth, verify, authentified, isAdmin, createSession, updateSession, deleteSession, getSession, deleteCurrentSession };
}

export const SCHEMA = {
	body: {
		type: 'object',
		properties: {
			email: {
				type: 'string'
			},
			createdAt: {
				type: 'integer' //date ?
			},
			expireAt: {
				type: 'integer' //date ?
			}
		}
	}
};
