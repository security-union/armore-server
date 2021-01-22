#!/bin/bash

if [ $# -eq 0 ]
then
    echo "No deployment name supplied. This must be the same as the name of your custom values.yaml file in secrets/"
    exit 1;
fi

if [ -z "$ARMORE_BERGLAS_KEY" ]
then
    echo "Must set ARMORE_BERGLAS_KEY env var."
    exit 1;
fi

if [ -z "$BUCKET_ID" ]
then
    echo "Must set BUCKET_ID env var."
    exit 1;
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

deployment_name=$1

berglas create ${BUCKET_ID}/${deployment_name} $(cat $DIR/../secrets/${deployment_name}.yaml | base64) --key $ARMORE_BERGLAS_KEY
