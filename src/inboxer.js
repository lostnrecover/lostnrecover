
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { config } from './config.js';
// Parse email
let isRunning = false;

console.log("Run", config.imap);
const escapedDomain = config.DOMAIN.replaceAll(".",'\.');
const regex = new RegExp(`^tag-(.*)@${escapedDomain}$`);

const client = new ImapFlow({...config.imap, logger: false});
const main = async () => {
	if(isRunning) {
		return false;
	}
	isRunning = true;
	// Wait until client connects and authorizes
	await client.connect();

	// Select and lock a mailbox. Throws if mailbox does not exist
	let lock = await client.getMailboxLock('INBOX');
	try {
			// fetch latest message source
			// client.mailbox includes information about currently selected mailbox
			// "exists" value is also the largest sequence number available in the mailbox
			// let message = await client.fetchOne(client.mailbox.exists, { source: true });
			// console.log('fetch one', message.source.toString());

			// list subjects for all messages
			// uid value is always included in FETCH response, envelope strings are in unicode.
			for await (let message of client.fetch({  }, { envelope: true, source: true })) {
				let msg = await simpleParser(message.source)
				console.log(`${message.uid}: ${message.envelope.subject} ${Object.keys(message)}`, msg.to.value);
				let tagId = [].concat(msg.to?.value || [], msg.cc?.value || []).reduce((prev, el) => {
					if(!prev) {
						let m = el.address.match(regex);
						if(m) {
							return m[1]; 
						}
					}
					return prev;
				}, false);
				if(tagId) {
					// Register mail with discovery conversation
					// Archive mail
					// await client.messageMove(message, 'Archives');
					let result = await client.messageMove(message.id, 'INBOX/Archives');
					console.log('Archived %s messages', result.uidMap.size);
				} else {
					// move to "support"
					let result = await client.messageMove(message.id, 'INBOX/Support');
					console.log('Moved %s messages', result.uidMap.size);
				}
			}
	} catch (e) {
		console.log(e)
	} finally {
			// Make sure lock is released, otherwise next `getMailboxLock()` never returns
			lock.release();
	}

	// log out and close connection
	await client.logout();
};

main().catch(err => {
	console.error(err)
});

