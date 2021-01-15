-- migrate:up
CREATE TYPE ChargingState AS ENUM ('ChargingUsb', 'ChargingAc', 'NotCharging', 'UNKNOWN');

ALTER TABLE device_telemetry
    ADD charging_state ChargingState DEFAULT 'UNKNOWN' NOT NULL;

ALTER TABLE device_telemetry
    ADD battery_level FLOAT DEFAULT 0 NOT NULL;

ALTER TABLE device_telemetry
    ADD is_charging BOOLEAN DEFAULT false NOT NULL;

-- migrate:down
ALTER TABLE device_telemetry
    DROP COLUMN charging_state;

ALTER TABLE device_telemetry
    DROP COLUMN battery_level;

ALTER TABLE device_telemetry
    DROP COLUMN is_charging;

DROP TYPE ChargingState;
