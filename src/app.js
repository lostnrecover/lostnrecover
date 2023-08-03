// Fastify
import Fastify from 'fastify';
import { loadFastifyPlugins } from './utils/plugins.js';
import { errorHandler } from './utils/errors.js';
import { initJobs } from './utils/jobs.js';
import { config } from './config.js';
import qs from 'qs';

import * as TagsAPI from './routes/v1/tags.js';
import * as Auth from './routes/session.js';
import * as User from './routes/user.js';
import * as PrivateTagsController from './routes/tags-edit.js';
import * as PublicTagsController from './routes/tags.js';
import * as Public from './routes/public.js';
import * as Admin from './routes/admin.js';
import * as AdminBatchPrint from './routes/admin/batch-print.js'
import * as AdminUsers from './routes/admin/users.js'
import * as PdfContoller from './routes/pdf.js';
import * as CodeController from './routes/code.js';
import * as InstructionsController from './routes/instructions.js';
import { getLogger } from './utils/logging.js';


export async function initApp(opts) {
	// Basic server
	const defaultOpts = {
		trustProxy: true,
		logger: getLogger(config),
		ignoreTrailingSlash: true,
		querystringParser: str => qs.parse(str, { allowDots: true, allowSparse: true})
	},
	fastify = Fastify({...defaultOpts, ...opts});
	fastify.decorate('config', config)

	fastify.log.info('Load plugins...')
	// Init server config and extensions
	loadFastifyPlugins(fastify, config);
	fastify.setErrorHandler(errorHandler)

	fastify.log.info('Register routes...')
	// Init routes
	fastify.register(Auth);
	fastify.register(Public);
	fastify.register(Admin, { prefix: '/admin' });
	fastify.register(AdminUsers, { prefix: '/admin/user'});
	fastify.register(AdminBatchPrint, { prefix: '/admin/print' })
	fastify.register(PublicTagsController, { prefix: '/t' });
	fastify.register(PrivateTagsController, { prefix: '/tags'});
	fastify.register(CodeController, { prefix: '/code' })
	fastify.register(PdfContoller, { prefix: '/pdf' });
	fastify.register(User, { prefix: '/account' });
	fastify.register(InstructionsController, { prefix: '/instructions'})
	
	// fastify.register(TagsAPI, { prefix: '/api/1/tags'});

	fastify.decorate('initJobs', async () => {
		// on demande job init
		return initJobs(fastify, config);
	})

	return fastify;
}


