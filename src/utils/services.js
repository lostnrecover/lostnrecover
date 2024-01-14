import { AuthTokenService } from '../services/authtoken.js';
import { DiscoveryService } from '../services/discovery.js';
import { EXCEPTIONS } from '../services/exceptions.js';
import { InstructionsService } from '../services/instructions.js';
import { MessageService } from '../services/messages.js';
import { PdfService } from '../services/pdf.js';
import { QRService } from '../services/qr.js';
import { StatusService } from '../services/status.js';
import { TagService } from '../services/tags.js';
import { UserService } from '../services/user.js';


export async function serviceLoader(db, logger, config) {
	let services = {};
	services.AUTH = await AuthTokenService(db, logger, config);
	// MessageService, // no dep
	services.MSG = await MessageService(db, logger, config);
	// QRService, // no dep
	services.QR = await QRService(db, logger, config);
	// UserService, // AuthTokenService
	services.USERS = await UserService(db, logger, config, services.AUTH);
	// InstructionsService, // UserService
	services.INSTRUCTIONS = await InstructionsService(db, logger, config, services.USERS);
	// TagService,  // UserService, InstructionsService
	services.TAGS = await TagService(db, logger);
	// DiscoveryService, // MessageService, TagService, UserService
	services.DISC = await DiscoveryService( db, logger, config, services.MSG, services.TAGS, services.USERS);
	// PdfService, // TagService, QRService
	services.PDF = await PdfService(db, logger, config, services.TAGS, services.QR);
	// StatusService, //UserService, TagService
	services.STATUS = await StatusService(db, logger, config, services.USERS, services.TAGS);
	return services;
}
export async function initServices(fastify) {
	let asserAuthenticated = async (request, reply) => { 
			let authenticated = await fastify.services.AUTH.authentified(request, reply);
			if(!authenticated) {
				throw(EXCEPTIONS.NOT_AUTHORISED);
			} 
		},
		assertAdmin = async (request, reply) => { 
			let isAdmin = false;
			await asserAuthenticated(request, reply);
			isAdmin = await fastify.services.AUTH.isAdmin(request, reply);
			if(!isAdmin) {
				throw(EXCEPTIONS.FORBIDDEN);
			} 
		};
	fastify.decorate('services', {});
	fastify.decorate('authentified', asserAuthenticated);
	fastify.decorate('isAdmin', assertAdmin);
	fastify.addHook('onReady', async () => {
		let logger = fastify.log.child({ module: 'services' }),
			db = fastify.mongo.db,
			config = fastify.config,
			services = await serviceLoader(db, logger, config);
		for (const [key, value] of Object.entries(services)) {
			logger.info(`Loaded ${key} service`);
			fastify.services[key] = value;
		}
	});
}