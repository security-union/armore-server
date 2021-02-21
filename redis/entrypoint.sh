#!/bin/bash

gcsfuse --implicit-dirs -o nonempty --key-file /secrets/cloudsql/credentials.json armore_redis_telemetry /redis-data
redis-server /redis.conf