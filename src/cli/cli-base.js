import { config } from '../config.js';
import { MongoClient } from 'mongodb';
// import mongodb from '@fastify/mongodb'
import pino from 'pino';

export async function initCli() {
	let logger = pino({
		transport: {
			target: 'pino-pretty'
		}
	});
	logger.info('Connecting to %s', config.db_url);
	let client = new MongoClient(config.db_url);
	await client.connect();
	return {
		logger,
		config,
		db: client.db(),
		close: async (code) => {
			await client.close();
			process.exit(code ?? 0);
		}
	};
}