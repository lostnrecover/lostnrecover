import {glob} from 'glob';
import { readFile, writeFile } from 'fs/promises';
import Handlebars from "handlebars";

 function extractBlock(block) {
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
				strings.push(...extractBlock(subblock))
			})
		}
	} else if (block.type == 'PartialStatement') {
		if(block.hash && block.hash.type == 'Hash') {
			block.hash.pairs.forEach(subblock => {
				strings.push(...extractBlock(subblock.value));
			})
		}
	} else if (block.type == 'BlockStatement' || block.type == 'PartialBlockStatement') {
		block.program.body.forEach(subblock => {
			strings.push(...extractBlock(subblock));
		});
	} else {
		if(['ContentStatement', 'CommentStatement', 'PathExpression', 'StringLiteral'].indexOf(block.type) < 0) {
			console.error('Unknown block type', block.type, block)
		}
	}
	return strings; 
}

async function extract(template, debug) {
	let strings = [], output = Handlebars.parse(template), debugContent = [];
	output.body.forEach(block => {
		strings.push(...extractBlock(block))
	});
	if(debug) {
		writeFile('debug.l10n.json', JSON.stringify(output.body, null, 2));
	}
	return strings;
}

async function search(dir, full) {
	let res = await glob(`${dir}/**/*.hbs`), frLocale = JSON.parse(await readFile(`${dir}/locales/fr.json`));
	if(res) {
		res.forEach(async file=>{
			let template = await readFile(file),  matches = await extract(template.toString());
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
	let res = await extract((await readFile(template)).toString(), true);
	console.log(res);
}

let args = process.argv.slice(2), 
	file = args[0],
	test = '/home/coder/project/lostnfound/src/templates/test.hbs';

if(!file) {
	search('src/templates');
} else {
	print(file);
}