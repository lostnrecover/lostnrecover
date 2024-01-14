import nodemailer from 'nodemailer';

// import Fixtures from 'node-mongodb-fixtures';
// https://github.com/mathiasbynens/quoted-printable/blob/master/quoted-printable.js
export function format(mail) {
	// return mail.replaceAll(/=$\r\n/gm, '').replaceAll(/=3D/gm, '=')
	return mail
	// https://tools.ietf.org/html/rfc2045#section-6.7, rule 3:
	// “Therefore, when decoding a `Quoted-Printable` body, any trailing white
	// space on a line must be deleted, as it will necessarily have been added
	// by intermediate transport agents.”
		.replace(/[\t\x20]$/gm, '')
	// Remove hard line breaks preceded by `=`. Proper `Quoted-Printable`-
	// encoded data only contains CRLF line  endings, but for compatibility
	// reasons we support separate CR and LF too.
		.replace(/=(?:\r\n?|\n|$)/g, '')
	// Decode escape sequences of the form `=XX` where `XX` is any
	// combination of two hexidecimal digits. For optimal compatibility,
	// lowercase hexadecimal digits are supported as well. See
	// https://tools.ietf.org/html/rfc2045#section-6.7, note 1.
		.replace(/=([a-fA-F0-9]{2})/g, function ($0, $1) {
			var codePoint = parseInt($1, 16);
			return String.fromCharCode(codePoint);
		});
}

export async function sendMail(message, messageService, t) {
	let url;
	message = await messageService.send(message._id);
	t.equal(message.status, 'sent', 'email successfully sent');
	url = nodemailer.getTestMessageUrl(message.response);
	t.match(url, 'https://ethereal.email/message', 'ethreal url ok');
	// fetch mocked mail and inspect content
	message._content = await fetch(url + '/message.eml');
	// https://ethereal.email/message/ZCbHHf7y76xDTcZUZDwcCZ7rNWhe.0ajAAAAI5OdbhzaYppBZQo3XhD9ZWk/message.eml
	// t.match(redirect, '/t/lost_tag_1/notify', 'to notify id')
	message._mail = format(await message._content.text());
	return message._mail;
}