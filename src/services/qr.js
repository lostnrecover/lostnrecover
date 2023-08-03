import QRCode from 'qrcode';
import path from 'path'
import fs from 'fs';

export async function QRService(mongodb, parentLogger, config) {
	const TMPDIR = config.cache_dir,
	// TAGS = mongodb.collection(COLLECTION),
	logger = parentLogger.child({ service: 'QRCode' });

	async function getQRCodeFile(tagId, format, refreshCache) {
		let options = {}, cacheFileName, code, directory;
		options.type = 'svg'
		if (format == 'png') {
			options.type = 'png'
		}
		directory = tagId.replace(/(.{3})(.*)/, "$1/$2");
		fs.mkdirSync(path.join(TMPDIR, directory), {recursive: true});
		cacheFileName = path.join(TMPDIR, directory, `/${tagId}.${options.type}`)
		if(!fs.existsSync(cacheFileName) || refreshCache) {
			let t = await generateCode(cacheFileName, tagId, options);
		} else {
			logger.info(`using cache file ${cacheFileName}`);
		}
		return cacheFileName;
	}
	async function generateCode(filename, tagId, options) {
		let domain = config.SHORT_DOMAIN ?? config.DOMAIN,
			text = `https://${domain}/t/${tagId}`, physicalPath = path.join(filename);
		return new Promise((resolve, reject) => {
			if(options.type == 'png') {
				QRCode.toFile(physicalPath, text, (err) => {
					if(err) {
						logger.child({filename, text, options}).error(`Error generating Code: ${err}`)
						reject(`Error generating Code: ${err}`)
					} else {
						resolve(filename);
					}
				})
			} else {
				options.type = 'svg';
				QRCode.toString(text, options, (err, txt) => {
					if(err) {
						logger.child({filename, text, options}).error(`Error generating Code: ${err}`)
						reject(`Error generating Code: ${err}`)
					}
					logger.child({filename, text, options, txt}).info('Generated')
					if(options.type == 'svg') {
						//Append domain and tagId
						// let domainTag = `<text x="50%" y="1.75" dominant-baseline="middle" text-anchor="middle" font-family="Helvetica" font-size="3">${domain}</text>`
						// let tagTag = `<text x="50%" y="35.5" dominant-baseline="middle" text-anchor="middle" font-family="Courier"  font-size="3">Id: ${tagId}</text> `
						// let t = txt.replace('</svg>',`${domainTag}${tagTag}</svg>`);
						fs.writeFileSync(physicalPath, txt);
					}
					resolve(filename);
				})
			}
		});
	}

	return { getQRCodeFile }
}
