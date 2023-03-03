
export const EXCEPTIONS = {
  NOT_AUTHORISED: { code: 401, view: 'magicLink/form' },
  NOT_FOUND: { code: 404, message: "Not Found" },
	TAG_NOT_FOUND: { code: 404, message: "Not Found", view: 'tag/notfound' },
	USER_NOT_FOUND: { code: 404, message: "Not Found" },
	BAD_REQUEST: { coide: 400, message: "Bad Request"},
  EMPTY_MAIL_BODY: { code: 500 },
  CANNOT_NOTIFY_OWNER: { code: 400, message: "You seem to be the owner of this tag. Why would you want to receive instructions to return it to yourself ?"},
  MISSING_TAG: { code: 400, message: "A tag reference is mandatory" },
}
