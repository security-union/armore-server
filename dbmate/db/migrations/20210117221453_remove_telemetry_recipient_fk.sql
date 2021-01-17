-- migrate:up
ALTER TABLE device_telemetry DROP CONSTRAINT device_telemetry_recipient_username_fkey;
-- migrate:down
ALTER TABLE device_telemetry
  ADD CONSTRAINT device_telemetry_recipient_username_fkey
  FOREIGN KEY (recipient_username)
  REFERENCES users(username)
  ON DELETE CASCADE;

