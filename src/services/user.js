import { nanoid } from "nanoid";
export function UserService(mongodb) {
	const COLLECTION = ' users'
	const PUBLIC_PROJECTION = { _id: 1, email: 1, status: 1 }
	const USERS = mongodb.collection(COLLECTION);

	async function get(id, projection) {
		return USERS.findOne({ id }, { projection: projection || PUBLIC_PROJECTION });
	}

	async function findOrCreate(email) {
		let user = await USERS.findOne({ email }, { projection: PUBLIC_PROJECTION});
		if(!user) {
			return await create({ email })
		} else {
			return user
		}
	}

	async function create(user) {
		user._id = nanoid();
		if (!user.status) {
			user.status = 'active';
		}
		user.createdAt = Date.now();
		const result = await USERS.insertOne(user);
		console.log(result)
		if(!result.acknowledged) {
			throw('Impossible to create user profile')
		}
		return await get(result.insertedId, PUBLIC_PROJECTION)
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
					enum: ["new", "active", "lost", "archived"]
				}
			}
		}
	}

	return {
		SCHEMA, get, findOrCreate, create
	}
}