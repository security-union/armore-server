-- migrate:up
ALTER TABLE geofences ADD name varchar(255) DEFAULT 'PRIVATE' NOT NULL;
ALTER TABLE geofences ADD address varchar(255) DEFAULT 'PRIVATE' NOT NULL;

-- migrate:down
ALTER TABLE geofences DROP COLUMN name;
ALTER TABLE geofences DROP COLUMN address;
