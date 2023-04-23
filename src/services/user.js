import { nanoid } from "nanoid";
import { initCollection } from "../utils/db.js";
import { AuthTokenService } from "./authtoken.js";
import { EXCEPTIONS } from "./exceptions.js";

// Manage a user account collection for future anonymization:
// an email is linked to a user account (nanoid) and the account id should be used for relation
// anonymization may be obtained by removing the email address from the user account
// tobe done only if all tags are archived first
// NB: only fully works if contact email is removed from tag when its archived

export async function UserService(mongodb, parentLogger, config) {
	const logger = parentLogger.child({ service: 'User' }),
		COLLECTION = 'users',
		PUBLIC_PROJECTION = { _id: 1, email:1, status: 1, tz: 1, locale: 1, displayName: 1},
		// USERS = mongodb.collection(COLLECTION),
		{verify} = await AuthTokenService(mongodb, logger, config);
	let USERS = await initCollection(mongodb, COLLECTION);
	//.then(col => USERS = col);

	async function get(filter, projection) {
		if(!filter._id && !filter.email) {
			throw("Can't get user without email or _id")
		}
		return USERS.findOne(filter); //, { projection: projection || PUBLIC_PROJECTION });
	}

	async function findOrFail(email) {
		let user = await USERS.findOne({ email }); //, { projection: PUBLIC_PROJECTION});
		if(!user) {
			throw EXCEPTIONS.NOT_AUTHORISED;
		}
		return user;
	}
	async function findOrCreate(email, reason) {
		let user = await USERS.findOne({ email }) //, { projection: PUBLIC_PROJECTION});
		if(!user) {
			user = await create({ email, createdFrom: reason });
		}
		return user;
	}

	async function findById(id) {
		let user = await USERS.findOne({ _id: id }); //, { projection: PUBLIC_PROJECTION});
		return user;
	}

	async function create(user) {
		// TODO: user data cleanup (according to schema)
		user._id = nanoid();
		if (!user.status) {
			user.status = 'new';
		}
		user.createdAt = new Date();
		const result = await USERS.insertOne(user);
		if(!result.acknowledged) {
			throw('Impossible to create user profile')
		}
		return get({ _id: result.insertedId }) //, PUBLIC_PROJECTION)
	}

	async function list(filter) {
		let f = filter || {};
		return await USERS.find(f).toArray();
	}

	async function login(token) {
		let email = await verify(token);
		if(!email) {
			throw('Invalid Token')
		}
		let user = await findOrCreate(email, 'signin')
		if(!user) {
			throw('Invalid Token')
		}
		USERS.updateOne({ _id: user._id }, {
			$set: {
				status: 'active',
				lastLogin: new Date()
			}
		}).catch(error => {
			logger.error({msg: 'Error while updating user status', error, user})
		});
		return user
	}

	async function update(id, user) {
		// remove protected fields
		delete user.createdAt;
		delete user.lastLogin;
		let result = await USERS.updateOne({
			_id: id
		}, { $set: {
			...user,
			updatedAt: new Date()
		}});
		//FIXME: check update result.
		return await get({ _id: id });
	}

	async function count() {
		let res = await USERS.aggregate([{
			$group:
				{
					_id: "$status", // Group key
					count: { $count: {} }
				}
		}]);
		return res.toArray();
	}

	const SCHEMA = {
		body: {
			type: 'object',
			required: ["email"],
			properties: {
				email: {
					type: 'string'
				},
				status: {
					type: "string",
					enum: ["new", "active", "finder"]
				}
			}
		}
	}

	return {
		SCHEMA, findOrCreate, findOrFail, findById, create, login, list, update, count
	}
}
