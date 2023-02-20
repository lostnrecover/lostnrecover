# Connecteur email

```plantuml
Actor Finder
Actor Owner
Queue Mail
Control Connecteur
Collections Messages

Finder -> Mail: Reply to instructions
...
Connecteur -> Connecteur++: Start process
Connecteur -> Mail++: Fetch
return New Mails
loop each mail
alt Mail to tag or discovery email from finder
Connecteur -> Messages++: Create object in discovery
Connecteur -> Mail : Forward mail to owner
Mail -> Owner: Mail



else Mail to tag or discovery email from owner
else Other mail
end
return ok
Connecteur -> Mail: Archive mail
end
```

Code Sample: [https://dev.to/akinmyde/reading-email-data-with-node-js-bjf](https://https://dev.to/akinmyde/reading-email-data-with-node-js-bjf)

