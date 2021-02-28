FROM node:12.2.0-alpine

ARG dbmate_url="https://github.com/amacneil/dbmate/releases/download/v1.11.0/dbmate-linux-amd64"

ENV NPM_CONFIG_LOGLEVEL=http

WORKDIR /app

#Install curl
RUN apk add curl

# Install DB Migration tool.
RUN curl -fsSL -o /usr/local/bin/dbmate $dbmate_url
RUN chmod +x /usr/local/bin/dbmate

COPY src /app/src
COPY *.json /app/
COPY yarn.lock .

RUN yarn install && \
    yarn build

STOPSIGNAL SIGINT
