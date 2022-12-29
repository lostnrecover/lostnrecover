
export const EXCEPTIONS = {
  NOT_AUTHORISED: { code: 401, redirect: '/login' },
  EMPTY_MAIL_BODY: { code: 500 },
  CANNOT_NOTIFY_OWNER: { code: 400, message: "You seem to be the owner of this tag. Why would you want to receive instructions to return it to yourself ?"}
}