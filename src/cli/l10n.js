import {glob} from 'glob';
import { readFile } from 'fs/promises';
import Handlebars from "handlebars";

async function extract(template) {
	let strings = [], output = Handlebars.parse(template);
	output.body.forEach(block => {
		if(block.type == 'MustacheStatement' && block.path.original == '__') {
			block.params.forEach(param => {
				if( param.type == 'StringLiteral') {
					let string = param.original;
					if(string.startsWith("'") || string.startsWith('"')) {
						string = string.slice(1,-1)
					}
					strings.push(string.trim());
				}
			});
		}
	});
	return strings;
}

async function search(dir) {
	let res = await glob(`${dir}/**/*.hbs`), frLocale = JSON.parse(await readFile(`${dir}/locales/fr.json`));
	if(res) {
		res.forEach(async file=>{
			let template = await readFile(file),  matches = await extract(template.toString());
			matches.forEach( string => {
				let exists = frLocale.hasOwnProperty(string);
				if(!exists) {
					console.log(exists ? '[ok] ' : '[ko] ', file, string, frLocale[string] ?? '');
				}
			});
		})
	}

}

search('src/templates')