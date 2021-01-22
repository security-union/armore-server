#!/bin/bash

if [ $# -eq 0 ]
then
    echo "No deployment name supplied."
    exit 1;
fi

if [ -z "$BUCKET_ID" ]
then
    echo "Must set BUCKET_ID env var."
    exit 1;
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

deployment_name=$1

berglas access ${BUCKET_ID}/${deployment_name} | base64 -d > $DIR/../secrets/${deployment_name}.yaml
