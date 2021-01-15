#!/bin/bash
set -e

TAG=$1
if [ -z "$1" ]
then
    TAG=$(git rev-parse HEAD)
fi

IMAGE_URL=gcr.io/iot-garage-242501/armore_dbmate:$TAG
echo "Building image "$IMAGE_URL

if ! docker build -t $IMAGE_URL . ; then
    echo "Failed to build armore_dbmate"
else
    docker push $IMAGE_URL
    echo "New image uploaded to "$IMAGE_URL
fi
