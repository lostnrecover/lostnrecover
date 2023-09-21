import { config } from './config.js';
import { MongoClient } from 'mongodb';
import { pino } from 'pino';
import {ConnectionString} from 'connection-string';
import { serviceLoader } from './utils/services.js';

const logger = pino();
const dbcs = new ConnectionString(config.db_url);
dbcs.params.appname=`${dbcs.params.appname}/healthcheck`;
const client = new MongoClient(dbcs.toString());
await client.connect();
let db = client.db();

let exit = 1;

async function run() {
	try {
		let status, services = await serviceLoader(db, logger, config);
		// Connect the client to the server (optional starting in v4.7)
    // Establish and verify connection
    console.log("Connected successfully to server");
		status = await services.STATUS.check("Monitoring script")
		console.log(status)
		exit = 0
  } catch {
    // Ensures that the client will close when you finish/error
		exit = 1;
  }
}
run().catch(console.dir).finally(async () => {
	// await client.close();
	process.exit(exit);
});
