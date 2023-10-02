import {glob} from 'glob';
import { readFile, writeFile } from 'fs/promises';
import Handlebars from "handlebars";

 function extractBlock(file, block) {
	let strings = [];
	if(block.type == 'MustacheStatement' || block.type == 'SubExpression') {
		if(block.path.original == '__' || block.path.original ==  '__loc') {
			block.params.forEach(param => {
				if( param.type == 'StringLiteral') {
					let string = param.original;
					if(string.startsWith("'") || string.startsWith('"')) {
						string = string.slice(1,-1)
					}
					strings.push(string.trim());
				} 
			});
		} else if (block.type == 'SubExpression') {
			block.params.forEach((subblock) => {
				strings.push(...extractBlock(file, subblock))
			})
		}
	} else if (block.type == 'PartialStatement') {
		if(block.hash && block.hash.type == 'Hash') {
			block.hash.pairs.forEach(subblock => {
				strings.push(...extractBlock(file, subblock.value));
			})
		}
	} else if (block.type == 'BlockStatement' || block.type == 'PartialBlockStatement') {
		if(block.hash && block.hash.type == 'Hash') {
			block.hash.pairs.forEach(subblock => {
				strings.push(...extractBlock(file, subblock.value));
			})
		}
		block.program.body.forEach(subblock => {
			strings.push(...extractBlock(file, subblock));
		});
	} else {
		if(['ContentStatement', 'CommentStatement', 'PathExpression', 'StringLiteral', 'BooleanLiteral'].indexOf(block.type) < 0) {
			console.error('Unknown block type', file, block.type, block)
		}
	}
	return strings; 
}

async function extract(file, template, debug) {
	let strings = [], output = Handlebars.parse(template), debugContent = [];
	output.body.forEach(block => {
		strings.push(...extractBlock(file, block))
	});
	if(debug) {
		writeFile(`tmp/l10n.debug.json`, JSON.stringify(output.body, null, 2));
	}
	return strings;
}

async function search(dir, full) {
	let res = await glob(`${dir}/**/*.hbs`), frLocale = JSON.parse(await readFile(`${dir}/locales/fr.json`));
	if(res) {
		res.forEach(async file=>{
			let template = await readFile(file),  matches = await extract(file, template.toString());
			matches.forEach( string => {
				let exists = frLocale.hasOwnProperty(string);
				if(!exists || full) {
					console.log(exists ? '[ok] ' : '[ko] ', file, string, '>',  frLocale[string] ?? '');
				}
			});
		})
	}
}

async function print(template) {
	let res = await extract(template, (await readFile(template)).toString(), true);
	console.log(res);
}

let args = process.argv.slice(2), 
	file = args[0];
	
// test = '/home/coder/project/lostnfound/src/templates/test.hbs';

if(!file) {
	search('src/templates');
} else {
	print(file);
}