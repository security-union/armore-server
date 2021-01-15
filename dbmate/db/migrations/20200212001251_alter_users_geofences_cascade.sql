-- migrate:up
ALTER TABLE geofences ADD UNIQUE(geofence_id);

ALTER TABLE users_geofences 
  ADD CONSTRAINT fk_geofence_id
  FOREIGN KEY (geofence_id) 
  REFERENCES geofences(geofence_id) 
  ON DELETE CASCADE;

-- migrate:down
