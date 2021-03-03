#!/bin/bash

gcsfuse --implicit-dirs --key-file /secrets/cloudsql/credentials.json $GCS_BUCKET /redis-data
redis-server /redis.conf
