import * as fastifyView from '@fastify/view';
import Handlebars from 'handlebars';
import * as fastifyStatic from '@fastify/static';
import * as enLocale from '../templates/locales/en.json' assert { type: "json" };

export default function(fastify, opts, done) {
  // console.log('Init templates', opts.templateDir)
  fastify.register(fastifyView, {
    engine: {
      handlebars: Handlebars
    },
    root: opts.templateDir,
    layout: '_layout.hbs'
    // defaultContext: {
    //   '_': enLocale.default
    // }
  });
  Handlebars.registerHelper("__", function(key) {
    // console.log('helper', typeof key)
    return enLocale.default[key] || `{{${key}}}`;
  });
  fastify.register(fastifyStatic, {
    root: opts.publicDir,
    prefix: '/public/'
  });
  fastify.get('/', (req,reply) => {
    reply.view('home', {})
  });
  fastify.get('/create', (req, reply) => {
    reply.view('newTagForm')
  })
  done()
}
