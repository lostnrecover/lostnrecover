
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { config } from '../config.js';
import replyParser from 'node-email-reply-parser';

const escapeDot = '\\.';
const escapedDomain = [config.SHORT_DOMAIN, config.DOMAIN].map(m => m.replaceAll('.',escapeDot)).join('|');
const regex = new RegExp(`^tag[-+](.*)@(${escapedDomain})$`);

export function extractTagId(imapMessage) {
	let tagId = [].concat(imapMessage.to?.value || [], imapMessage.cc?.value || []).reduce((prev, el) => {
		if(!prev) {
			let m = el.address.match(regex);
			if(m) {
				return m[1]; 
			}
		}
		return prev;
	}, false);
	return tagId;
}

export async function checkImapInbox(parentLogger, messageProcessor) {
	const logger = parentLogger.child({ module: 'IMAP'}),
		client = new ImapFlow({...config.imap, logger: false});
	// Wait until client connects and authorizes
	await client.connect();
	// Select and lock a mailbox. Throws if mailbox does not exist
	let lock = await client.getMailboxLock('INBOX');
	try {
		// Loop for all messages in INBOX
		for await (let message of client.fetch({  }, { envelope: true, source: true })) {
			let msg = await simpleParser(message.source);
			msg.filteredText = replyParser(msg.text, true);
			logger.debug({ to: msg.to, from: msg.from, subject: msg.subject});
			// let discoveryId = extractTagId(msg);
			// if(discoveryId) {
			// Register mail with discovery conversation
			let result = await messageProcessor(msg);
			if(result) {
				// Archive mail
				client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
				client.messageMove(message.uid, 'INBOX/Archives', { uid: true });
			} else {
				// move to "support"
				client.messageMove(message.uid, 'INBOX/Support', { uid: true });
			}
		}
	} catch (e) {
		logger.error(e);
	} finally {
		// Make sure lock is released, otherwise next `getMailboxLock()` never returns
		lock.release();
	}

	// log out and close connection
	await client.logout();
}


