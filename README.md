# Lost n recover app

Concept: The app allows to host your own recovery tag service: users can print QR codes on stickers to put on their stuff in order to provide recovery instructions to the person who finds the item when it's lost.

The app is designed for privacy and should allow users to only share personnal information for recovery to a limited set of persons.

How does it works

1. First you need to prepare stickers to put on your valuables
2. Then you attach recovery instructions to these tags, instructions may include contac tinforamtion like an postal address to send the stuff back or an email / phone number to arrange a meeting.
3. If you lose an item, you can flag it as lost so instructions are released automatically whne found
4. When someone finds your item and scan the QR code, it's invited to provide an email to receive the instructions to return your valuable.

Note: if someone finds a valuable not already flagged as lost (if you are not aware of the loss), you recevie anotification to confirm the loss before the instructions are shared.

## Installation

### Docker compose installation

Prerequisites: Docker and Docker Compose, optional a Traefik instance as a reverse proxy ([why](https://www.cloudflare.com/en-gb/learning/cdn/glossary/reverse-proxy/), [how](https://www.digitalocean.com/community/tutorials/how-to-use-traefik-v2-as-a-reverse-proxy-for-docker-containers-on-ubuntu-20-04))


## Roadmap / Future features

- // TODO webhooks features for integration
