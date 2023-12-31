import pino from 'pino';

// return pino options
export function getLogger(config) {
	let 
		options = { 
			level: process.env.ENV != 'dev' ? 'info' : 'debug',
			formatters: {
				level: (label, level) => {
					return { priority: level, level: label.toUpperCase() };
				},
				bindings: (bindings) => {
					return { pid: bindings.pid, hostname: config.DOMAIN || bindings.hostname, app: config.appName };
				}
			},
			// base: {pid: process.pid, hostname: os.hostname,  app: config.appName},
			timestamp: pino.stdTimeFunctions.isoTime,
		};

	if(process.env.ENV == 'test' || process.env.ENV == 'dev') {
		// log to file (stdout is for test report)
		// const fileTransport = pino.transport({
		// 	target: 'pino/file',
		// 	options: { destination: `${config.log_dir}/${process.env.ENV}.log` }
		// 	});
		options.file = `${config.log_dir}/${process.env.ENV}.log`;
		// return pino(pinooptions, fileTransport);
	}
	return pino(options);
}