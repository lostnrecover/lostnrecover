
import { initCli } from "./cli-base.js";
import { serviceLoader } from "../utils/services.js";

let cli = await initCli();
let args = process.argv.slice(2), 
	email = args[1],
	state = ((args[0] ?? 'set') == 'set') ? true : false;

cli.logger.info(args);
if(!email) {
	cli.logger.error("Missing argument user email address")
	process.exit(99);
}
try {
	// Make the appropriate DB calls
	// await  listDatabases(client);
	let services = await serviceLoader(cli.db, cli.logger, cli.config);
	let u = await services.USERS.findOrFail(email);
	if(u.isAdmin == state) {
		cli.logger.warn('User already %s', state ? 'admin' : 'not admin')
	} else {
		await services.USERS.update(u._id, {isAdmin: state});
		u = await services.USERS.findOrFail(email)
	}
	cli.logger.info(u);
} catch (e) {
	logger.error(e);
} finally {
	await cli.close();
}