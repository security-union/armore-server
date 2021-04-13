FROM debian:buster-slim

ARG dbmate_url="https://github.com/amacneil/dbmate/releases/download/v1.11.0/dbmate-linux-amd64"

WORKDIR /app

COPY startup.sh .
COPY db /app/db

ENV DBMATE_MIGRATIONS_DIR=/app/db/migrations

#Install curl
RUN apt-get update && \
    apt-get --yes install curl && \
    curl -fsSL -o /usr/local/bin/dbmate $dbmate_url && \
    chmod +x /usr/local/bin/dbmate && \
    chmod +x /app/startup.sh

ENTRYPOINT [ "/app/startup.sh" ]
