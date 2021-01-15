-- migrate:up
ALTER TABLE geofences ALTER COLUMN active SET NOT NULL;
ALTER TABLE geofences ALTER COLUMN active SET DEFAULT false;  

-- migrate:down

