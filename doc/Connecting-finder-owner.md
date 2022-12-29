## Connecting a tag's owner and the finder

```plantuml
actor finder
entity Found
participant lnf as "Lost and Found"
entity Tag
actor owner

== Setup ==

owner -> lnf: Create tag \n <back:yellow>POST /t
lnf -> Tag**: Create Tag \n status: active
lnf -> lnf: And redirect \n <back:yellow>GET /t/{tagid}
lnf --> owner: QR code and tagId \n <back:yellow>__view__: view.hbs

opt
 owner -> lnf: Declare loss \n <back:yellow>POST /t{tagid}/lost
 lnf -> Tag: Tag status: lost
lnf -> lnf: And redirect \n <back:yellow>GET /t/{tagid}
 lnf --> owner: <back:yellow> __view__: view.hbs
end

== Found ==

finder -> lnf++: Scan Tag \n <back:yellow>GET /t/{tagid}

alt "unless active session"
  lnf --> finder: Ask for email \n __view__: <back:yellow>found.hbs</back> (without session)
  finder -> lnf: Provide email \n <back:yellow>POST /t/{tagid}/notify
  lnf --> finder: Verify your email \n __view__: <back:yellow>email_verify.hbs

  lnf -> finder: Send verification link \n __mail__: <back:yellow>verify.hbs
  
  finder -> lnf: Verify email \n <back:yellow>GET /auth?token=${token}&redirect=/t/{tagid}
  lnf -> lnf: authenticate and redirect \n <back:yellow>GET /t/{tagid}
end

lnf --> finder: Ask to confirm notification  \n If session is new ask for expiration ? \n  __view__ : <back:yellow>found.hbs</back> (active session)
finder -> lnf: Confirm \n <back:yellow>POST /t/{tagid}/notify

lnf -> Found**: New Found Notification

alt if tag still __active__
  lnf -> owner++: Ask owner if lost \n __mail__: <back:yellow>loss-confirmation.mail.hbs</back> (with loss confirmation question)
  owner --> lnf: Confirm loss
  lnf -> lnf: status **lost**
else if tag __lost__
  lnf -> owner: Notify owner \n __mail__: <back:yellow>found-notification.mail.hbs</back>
end

alt if tag __lost__
  lnf --> finder--: Instructions \n __view__: <back:yellow>instructions.mail.hbs
  finder -> lnf: Update Found status

...

owner -> lnf: Check Found Request status
lnf --> owner: Ask for confirmation and thank you note
owner -> lnf: Confirm recovery
lnf -> finder: Thanks you mail \n mail: thank you.hbs
lnf -> lnf: tag status active

else if tag is __archived__
  lnf -> finder: Explain tag archive
end
```
