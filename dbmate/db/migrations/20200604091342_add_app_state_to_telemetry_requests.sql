-- migrate:up
CREATE TYPE AppState AS ENUM ('Foreground', 'Background', 'UNKNOWN');

ALTER TABLE device_telemetry
    ADD app_state AppState DEFAULT 'UNKNOWN' NOT NULL;

-- migrate:down
ALTER TABLE device_telemetry
    DROP COLUMN app_state;
