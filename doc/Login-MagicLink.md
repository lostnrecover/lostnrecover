# Login with MagicLink

```plantuml
participant mail
browser -> server ++: GET /login
return View loginForm

browser -> server ++: POST /login
server -> db++: token
return: ok
server -> mail: Mail with token
return View MagicLinkInstructions

...

mail -> browser: link
browser -> server ++: GET /auth?token
server->db ++: check
return ok
return View welcome \n with session

```
