#1 slim
FROM node:lts-slim as build_image

#2 alpine
# FROM node:lts-alpine as build_image
# RUN apk add --no-cache py3-pip make g++

WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm install
COPY public /app/public
COPY src /app/src

FROM node:lts-slim
# FROM node:lts-alpine

WORKDIR /app

# copy from build image
COPY --from=BUILD_IMAGE /app .


EXPOSE 3000

ENV HOST=0.0.0.0 PORT=3000

CMD ["npm", "start"]