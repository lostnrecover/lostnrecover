#1 slim
FROM node:20-slim as build_image

#2 alpine
# FROM node:lts-alpine as build_image
# RUN apk add --no-cache py3-pip make g++

WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm ci --only=production
COPY public /app/public
COPY src /app/src

FROM node:20-slim
# FROM node:lts-alpine

# Reco: https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init

ENV NODE_ENV production
ENV ENV prod
EXPOSE 3000
ENV HOST=0.0.0.0 PORT=3000
USER node
WORKDIR /app

# copy from build image
COPY  --chown=node:node --from=BUILD_IMAGE /app .

CMD ["dumb-init", "node", "src/server.js"]