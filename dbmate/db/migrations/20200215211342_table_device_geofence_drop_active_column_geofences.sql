-- migrate:up
CREATE TABLE device_geofence (
  geofence_id SERIAL NOT NULL,
  device_id VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL,
  update_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(geofence_id, device_id),
  FOREIGN KEY(geofence_id) REFERENCES geofences(geofence_id) ON DELETE CASCADE,
  FOREIGN KEY(device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

ALTER TABLE geofences DROP column active;

-- migrate:down
DROP TABLE device_geofence;
ALTER TABLE geofences ADD active BOOLEAN DEFAULT false NOT NULL;
