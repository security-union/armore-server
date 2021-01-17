#!/bin/bash
set -e

TAG=$1
if [ -z "$1" ]
then
    TAG=$(git rev-parse HEAD)
fi

IMAGE_URL=gcr.io/iot-garage-242501/server_rust:$TAG
echo "Building image "$IMAGE_URL

if ! docker build -t $IMAGE_URL . --file Dockerfile.production; then
    echo "Failed to build server_rust"
else
    docker push $IMAGE_URL
    echo "New image uploaded to "$IMAGE_URL
fi
