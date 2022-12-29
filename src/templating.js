import { format } from 'util'
import moment from 'moment-timezone';
import * as enLocale from './templates/locales/en.json' assert { type: "json" };
import * as frLocale from './templates/locales/fr.json' assert { type: "json" };
import fs from 'fs'
import path from 'path'
import glob from 'glob';

const messages = {
  'fr': frLocale.default,
  'en': enLocale.default
}

// console.log('messages', messages);

export function loadHelpers(Handlebars, templateDir) {
  Handlebars.registerHelper("__", function(key) {
    const args = [...arguments];
    let data = [], locale = this.locale, tr = `${key}`, needle = key.replace(/(\r\n|\n|\r)/gm, "").trim();
    if(args.length > 2) {
      data = args.slice(1,-1);
    }
    // console.log('locale', locale, needle, data, messages[locale][needle])
    // let options = args.slice(-1);
    // // let locale = options.data.locale || 'en';
    // console.log('helper', options.lookupProperty(this, 'locale'))
    if(messages[locale] && messages[locale][needle]) {
      tr = messages[locale][needle];
    } else if(locale != 'en') {
      console.error('Missing translation', locale, needle)
    }
    return format(tr, ...data);
  });
  Handlebars.registerHelper('dateFormat', function dateFormat(date, format, options) {
    let locale = this.locale || options.data.root.locale || 'en';
    // TODO: Detect timezone at login ? or browser to update the session [ Intl.DateTimeFormat().resolvedOptions().timeZone ]
    console.log('locale time', locale)
    return (true) ? moment(date).tz('Europe/Paris').locale(locale).format(format) : moment(date).locale(locale).format(format);
  });
  Handlebars.registerHelper('iconLink', function(href, icon, text) {
    return `<a href="${href}"><button><img src="public/icons/${icon}.svg" alt="${text}" /></button></a>`
  });
  Handlebars.registerHelper('iconButton', function( icon, text) {
    return `<button type="submit"><img src="public/icons/${icon}.svg" alt="${text}" /></button>`
  });
  Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
  });
  Handlebars.registerHelper('ifNotEquals', function(arg1, arg2, options) {
    return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
  });
  Handlebars.registerHelper('localizedFile', function(filename, options) {
    let locale = this.locale || options.data.root.locale || 'en';
    let files = [ `locales/${filename}.${locale}.hbs`, `locales/${filename}.hbs`, `${filename}.${locale}.hbs`, `${filename}.hbs`];
    for (const idx in files) {
      if (Object.hasOwnProperty.call(files, idx)) {
        const file = files[idx], p = path.join(templateDir, file);
        console.log('try', p, messages[locale][p])
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
}

export function loadPartials(Handlebars, templateDir) {  
  // Handlebars.registerPartial('tagForm', fs.readFileSync(path.join(templateDir, '/tag/_tagForm.hbs')).toString());
  glob(`${templateDir}/**/__*.hbs`, (error, partials)=> {
    if(error){
      return console.log(error)
    }
		partials.map((partial) => {
			let pattern = /.*\/__(.*)\.hbs/gi
			let res = pattern.exec(partial)
			// console.log('partial found', partial, res[1])
			Handlebars.registerPartial(res[1], fs.readFileSync(path.join(partial)).toString());
		});
  });
}
