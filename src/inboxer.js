
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { config } from './config.js';
// Parse email
let isRunning = false;

console.log('Run', config.imap);
// TODO Fix eslint disable
// noeslint-disable-next-line no-useless-escape
const escapeDot = '\\.';
const escapedDomain = [config.SHORT_DOMAIN, config.DOMAIN].map(m => m.replaceAll('.',escapeDot)).join('|');
const regex = new RegExp(`^tag-(.*)@(${escapedDomain})$`);

const client = new ImapFlow({...config.imap, logger: false});
const main = async () => {
	if(isRunning) {
		return false;
	}
	isRunning = true;
	// Wait until client connects and authorizes
	await client.connect();
	let list = await client.list();
	list.forEach(mailbox=>console.log(mailbox.path));
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
			let msg = await simpleParser(message.source);
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
				client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
				client.messageMove(message.uid, 'INBOX/Archives', { uid: true });
			} else {
				// move to "support"
				client.messageMove(message.uid, 'INBOX/Support', { uid: true });
			}
		}
	} catch (e) {
		console.error(e);
	} finally {
		// Make sure lock is released, otherwise next `getMailboxLock()` never returns
		lock.release();
	}

	// log out and close connection
	await client.logout();
};

main().catch(err => {
	console.error(err);
});

