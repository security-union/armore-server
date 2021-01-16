-- migrate:up
ALTER TABLE devices ADD push_token varchar(255);
ALTER TABLE devices ADD app_version varchar(255);


-- migrate:down
ALTER TABLE devices DROP COLUMN push_token;
ALTER TABLE devices DROP COLUMN app_version;
