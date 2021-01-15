-- migrate:up
ALTER TABLE device_locations ADD recipient_username varchar(255) DEFAULT '' NOT NULL;
ALTER TABLE device_locations ADD encrypted_location TEXT DEFAULT '' NOT NULL;

ALTER TABLE device_locations
  ADD CONSTRAINT fkRecipientUsername
  FOREIGN KEY (recipient_username)
  REFERENCES users(username)
  ON DELETE CASCADE;

-- migrate:down
ALTER TABLE device_locations DROP CONSTRAINT fkRecipientUsername;
ALTER TABLE device_locations DROP COLUMN recipient_username;
ALTER TABLE device_locations DROP COLUMN encrypted_location;
