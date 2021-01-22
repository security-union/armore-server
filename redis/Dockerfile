FROM redis:5-buster

RUN apt-get update && \
    apt-get install -y \
        ca-certificates \
        curl \
        fuse \
        gnupg2

ENV GCSFUSE_REPO=gcsfuse-buster

RUN echo "deb http://packages.cloud.google.com/apt $GCSFUSE_REPO main" | tee /etc/apt/sources.list.d/gcsfuse.list && \
    curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -

RUN apt-get update && \
    apt-get install gcsfuse && \
    apt-get clean all && \
    groupadd fuse && \
    usermod -aG fuse redis && \
    ln -s /go/bin/gcsfuse /usr/local/bin

COPY redis.conf /redis.conf

RUN mkdir /redis-data

VOLUME /data
WORKDIR /data

EXPOSE 6379

ENTRYPOINT []
CMD []
