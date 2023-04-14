FROM node:latest

WORKDIR /app

COPY package.json .

RUN npm install

COPY public /app/public
COPY src /app/src

EXPOSE 3000

ENV HOST=0.0.0.0 PORT=3000

CMD ["npm", "start"]