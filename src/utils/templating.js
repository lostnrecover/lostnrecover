import { format } from 'util'
import moment from 'moment-timezone';
// import * as enLocale from '../templates/locales/en.json' assert { type: "json" };
// import * as frLocale from '../templates/locales/fr.json' assert { type: "json" };
import fs, { readFileSync } from 'fs'
import path from 'path'
import {glob} from 'glob';

const messages = {
	'fr': JSON.parse(readFileSync('./src/templates/locales/fr.json')), //frLocale.default,
	'en': JSON.parse(readFileSync('./src/templates/locales/en.json')) //enLocale.default
}

export function templateGlobalContext(config, locale) {
	let context = {
		config,
		locale,
		pkg: config.pkg,
		env: process.env.ENV
	}
	delete context.config.cookies;
	// delete context.config.mail_transport;
	return context;
}

export function loadHelpers(logger, Handlebars, templateDir) {
	function extractAdditionnalData(args, offset) {
		let data = [], ar = [...args];
		if(ar.length > offset) {
			data = ar.slice(offset,-1);
		}
		return data;
	}

	function localizedText(requestedLocale, key, data) {
		let tr = `${key}`, needle = "", locale = requestedLocale ?? 'en';
		if(key) {
			needle = `${key}`.replace(/(\r\n|\n|\r)/gm, "").trim();
		} else {
			return "";
		}
		if (needle == "") {
			return "";
		}
		if(messages[locale] && messages[locale][needle]) {
			tr = messages[locale][needle];
		} else if(locale != 'en') {
			logger.warn({needle, locale}, 'missing translation');
		}
		return format(tr, ...data);
	}
	Handlebars.registerHelper("__", function(key) {
		return localizedText(this.locale, key, extractAdditionnalData(arguments, 1));
	});
	Handlebars.registerHelper("__loc", function(locale, key) {
		return localizedText(locale, key, extractAdditionnalData(arguments, 2));
	});
	Handlebars.registerHelper('debug', function(obj) {
		return JSON.stringify(obj, null, "  ");
	})
	Handlebars.registerHelper('dateFormat', function dateFormat(date, format, options) {
		let locale = this.locale || options.data.root.locale || 'en';
		// ?TODO: Detect timezone at login ? or browser to update the session [ Intl.DateTimeFormat().resolvedOptions().timeZone ]
		// TODO: use timezone from user profile
		return (true) ? moment(date).tz('Europe/Paris').locale(locale).format(format) : moment(date).locale(locale).format(format);
	});
	Handlebars.registerHelper('iconLink', function(href, icon, text) {
		return `<a href="${href}"><button><img src="public/icons/${icon}.svg" alt="${text}" /></button></a>`
	});
	Handlebars.registerHelper('iconButton', function( icon, text) {
		return `<button type="submit"><img src="public/icons/${icon}.svg" alt="${text}" /></button>`
	});
	Handlebars.registerHelper('localizedFile', function(filename, options) {
		let locale = this.locale || options.data.root.locale || 'en';
		let files = [ `locales/${filename}.${locale}.hbs`, `locales/${filename}.hbs`, `${filename}.${locale}.hbs`, `${filename}.hbs`];
		for (const idx in files) {
			if (Object.hasOwnProperty.call(files, idx)) {
				const file = files[idx], p = path.join(templateDir, file);
				logger.debug({msg: 'try', path: p, value: messages[locale][p]})
				if(messages[locale][p]) {
					return messages[locale][p](this);
				}
				if(fs.existsSync(p)) {
					let t = Handlebars.compile(fs.readFileSync(p).toString());
					messages[locale][p] = t;
					return t(this);
				}
			}
		}
	});
	Handlebars.registerHelper('selected', function(selected, option) {
		return (selected == option) ? 'selected="selected"' : '';
	});
	Handlebars.registerHelper('reverse', function(arr) {
		return Array.isArray(arr) ? arr.reverse() : arr;
	});
	Handlebars.registerHelper('eq', function(arg1, arg2) {
		return arg1 == arg2;
	});
	Handlebars.registerHelper('ne', function(arg1, arg2) {
		return arg1 != arg2;
	});
	Handlebars.registerHelper('or', function(arg1, arg2) {
		return arg1 || arg2;
	});
	Handlebars.registerHelper('and', function(arg1, arg2) {
		return arg1 && arg2;
	});
}

export async function loadPartials(logger, Handlebars, templateDir) {
	// Handlebars.registerPartial('tagForm', fs.readFileSync(path.join(templateDir, '/tag/_tagForm.hbs')).toString());
	Handlebars.registerPartial('layout', fs.readFileSync(path.join(templateDir, '/_layout.hbs')).toString())
	let partials = await glob(`${templateDir}/**/__*.hbs`)
	
		// if(error){
		// 	return logger.error(error)
		// }
	partials.map((partial) => {
		let pattern = /.*\/__(.*)\.hbs/gi
		let res = pattern.exec(partial)
		Handlebars.registerPartial(res[1], fs.readFileSync(path.join(partial)).toString());
	});
	// });
}
