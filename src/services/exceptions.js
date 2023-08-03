
export const EXCEPTIONS = {
  NOT_AUTHORISED: { code: 401, view: 'magicLink/form' },
  BAD_TOKEN: { code: 401, view: 'magicLink/form', message: 'Unauthorized' },
  NOT_FOUND: { code: 404, message: "Not Found" },
	TAG_NOT_FOUND: { code: 404, message: "Not Found", view: 'tag/notfound', data: { title: 'Tag not found'} },
  ACTION_NOT_AUTHORISED: { code:401, message: "Not Authorised"},
	USER_NOT_FOUND: { code: 404, message: "Not Found" },
	BAD_REQUEST: { code: 400, message: "Bad Request"},
  EMPTY_MAIL_BODY: { code: 500 },
  CANNOT_NOTIFY_OWNER: { code: 400, message: "You seem to be the owner of this tag. Why would you want to receive instructions to return it to yourself ?"},
  MISSING_TAG: { code: 400, message: "A tag reference is mandatory" },
  MAIL_NOT_READY: { code: 500, message: "Mail server not ready to send email" }
}

export function throwWithData(exception, data) {
  throw({...exception, data: { ...exception.data, ...data},  });
}