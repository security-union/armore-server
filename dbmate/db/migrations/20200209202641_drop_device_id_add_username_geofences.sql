-- migrate:up
ALTER TABLE geofences DROP COLUMN device_id;
ALTER TABLE geofences ADD username varchar(255) DEFAULT 'PRIVATE' NOT NULL;

-- migrate:down
ALTER TABLE geofences DROP COLUMN username;