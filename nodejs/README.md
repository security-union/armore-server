## Running server locally

Add a `.env` file in the server directory

```
CS_CREDENTIALS_FILE=/app/credentials.json
CS_TYPE=cloud-storage
CS_BUCKET=rescuelink_user_pictures
PUSH_NOTIFICATIONS_TOKEN_ANDROID=test
PUSH_NOTIFICATIONS_TOKEN_IOS=test
PUSH_NOTIFICATIONS_TOKEN_KEY_ID_IOS=test
PUSH_NOTIFICATIONS_TOKEN_TEAM_ID_IOS=test
SENDGRID_API_KEY=test
```

1. Install docker, docker-compose.
2. Build docker images using `docker-compose build`
3. Start services using `docker-compose up`
4. Stop services using `docker-compose stop`

## Download GCloud

https://cloud.google.com/sdk/docs/quickstart-linux

## Login to GCloud login

```
gcloud components install docker-credential-gcr
```

Also review https://cloud.google.com/docs/authentication/production
Also check https://github.com/GoogleCloudPlatform/docker-credential-gcr

Google GCR is a disaster, good luck!.

## Cutting a new docker image

```
docker build -t armore .
```

## Uploading image to Google Cloud

1. Tag the local image with the registry name by using the command:

```
docker build -t armore .
```

2. Docker tag the local image with the registry name by using the command.

Use the command:

```
docker tag [SOURCE_IMAGE] [HOSTNAME]/[PROJECT-ID]/[IMAGE]:[TAG]
```

```
docker tag armore gcr.io/iot-garage-242501/armore:$(git rev-parse HEAD)
```

```
docker push [HOSTNAME]/[PROJECT-ID]/[IMAGE]
```

```
docker push gcr.io/iot-garage-242501/armore:$(git rev-parse HEAD)
```

## Test Auth Server

1. Start docker compose.
2. call:

```
curl -d'{"username":"dario", "password":"talarico"}' -H "Content-Type: application/json" -X POST http://localhost:10000/login -v
```

```
curl -d'{"username":"dario", "password":"talarico"}' -H "Content-Type: application/json" -X POST https://armore.dev/login -v
```

## DB testing

# Login

```
psql -U postgres -h localhost "dbname=rescuelink"
```

password is docker.

# Create db

```
create database rescuelink;
```

Verify creation

```
postgres=# \l
                                 List of databases
   Name    |  Owner   | Encoding |  Collate   |   Ctype    |   Access privileges
-----------+----------+----------+------------+------------+-----------------------
 garage    | postgres | UTF8     | en_US.utf8 | en_US.utf8 |
 postgres  | postgres | UTF8     | en_US.utf8 | en_US.utf8 |
 template0 | postgres | UTF8     | en_US.utf8 | en_US.utf8 | =c/postgres          +
           |          |          |            |            | postgres=CTc/postgres
 template1 | postgres | UTF8     | en_US.utf8 | en_US.utf8 | =c/postgres          +
           |          |          |            |            | postgres=CTc/postgres
(4 rows)
```

Connect to database

```
\c rescuelink;
```

List all tables in current db

```
\dt
```

GRANT ALL PRIVILEGES ON DATABASE garage TO app;

GRANT USAGE ON SCHEMA public TO app;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app;

LIST permissions
garage=> SELECT table_catalog, table_schema, table_name, privilege_type
garage-> FROM information_schema.table_privileges
garage-> WHERE grantee = 'app';
table_catalog | table_schema | table_name | privilege_type
---------------+--------------+------------+----------------
(0 rows)

garage=> SELECT table_catalog, table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'postgres';

```
SELECT ud.username, ud.device_id, devices.role, ud.owner FROM devices INNER JOIN (select * from users_devices where username = 'dario') as ud ON devices.device_id = ud.device_id;
```

# Transform image file to base64

cat Dario.jpg | base64 -w 0
