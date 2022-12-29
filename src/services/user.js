import { nanoid } from "nanoid";
import { AuthTokenService } from "./authtoken.js";

export function UserService(mongodb, logger) {
	const COLLECTION = 'users'
	const PUBLIC_PROJECTION = { _id: 1, email: 
		1, status: 1 }
	const USERS = mongodb.collection(COLLECTION);
	const {verify} = AuthTokenService(mongodb, logger);

	async function get(filter, projection) {
		if(!filter._id && !filter.email) {
			throw("Can't get user without email or _id")
		}
		return USERS.findOne(filter, { projection: projection || PUBLIC_PROJECTION });
	}

	async function findOrCreate(email) {
		let user = await USERS.findOne({ email }, { projection: PUBLIC_PROJECTION});
		if(!user) {
			user = await create({ email })
		} 
		return user
	}

	async function create(user) {
		user._id = nanoid();
		if (!user.status) {
			user.status = 'new';
		}
		user.createdAt = new Date();
		const result = await USERS.insertOne(user);
		if(!result.acknowledged) {
			throw('Impossible to create user profile')
		}
		return get({ _id: result.insertedId }, PUBLIC_PROJECTION)
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
		let user = await findOrCreate(email)
		if(!user) {
			throw('Invalid Token')
		}
		USERS.updateOne({ _id: user._id }, {
			$set: {
				status: 'active',
				lastLogin: new Date()
			}
		}).then(r => {
			logger.error('Error while updating user status', user)
		});
		return email
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
		SCHEMA, findOrCreate, create, login, list
	}
}