-- migrate:up

CREATE TYPE LocationPermissionState AS ENUM ('ALWAYS', 'USING', 'ASK', 'NEVER', 'UNKNOWN');

ALTER TABLE devices ADD location_permission_state LocationPermissionState DEFAULT 'UNKNOWN' NOT NULL;
ALTER TABLE devices ADD is_notifications_enabled BOOLEAN;
ALTER TABLE devices ADD is_background_refresh_on BOOLEAN;
ALTER TABLE devices ADD is_location_services_on BOOLEAN;
ALTER TABLE devices ADD is_power_save_mode_on BOOLEAN;

CREATE TABLE device_settings (
    device_id varchar(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    os os,
    os_version VARCHAR(50),
    model VARCHAR(50),
    push_token VARCHAR(255),
    app_version VARCHAR(255),
    location_permission_state LocationPermissionState DEFAULT 'UNKNOWN' NOT NULL,
    is_notifications_enabled BOOLEAN,
    is_background_refresh_on BOOLEAN,
    is_location_services_on BOOLEAN,
    is_power_save_mode_on BOOLEAN,
    creation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (device_id, creation_timestamp),
    CONSTRAINT fk_device FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

INSERT INTO device_settings (
    device_id, role, name, os, os_version, model, 
    push_token, app_version, location_permission_state, is_notifications_enabled, 
    is_background_refresh_on, is_location_services_on, is_power_save_mode_on )
SELECT device_id, role, name, os, os_version, model,
    push_token, app_version, location_permission_state, is_notifications_enabled, 
    is_background_refresh_on, is_location_services_on, is_power_save_mode_on
FROM devices;

CREATE FUNCTION device_history() RETURNS trigger AS $device_history$
    BEGIN
        INSERT INTO device_settings SELECT NEW.*;
        RETURN NULL;
    END;
$device_history$ LANGUAGE plpgsql;

CREATE TRIGGER device_history AFTER INSERT OR UPDATE ON devices
    FOR EACH ROW EXECUTE PROCEDURE device_history();


-- migrate:down

DROP TABLE device_settings;

ALTER TABLE devices DROP COLUMN location_permission_state;
ALTER TABLE devices DROP COLUMN is_notifications_enabled;
ALTER TABLE devices DROP COLUMN is_background_refresh_on;
ALTER TABLE devices DROP COLUMN is_location_services_on;
ALTER TABLE devices DROP COLUMN is_power_save_mode_on;

DROP TRIGGER IF EXISTS device_history on devices;

DROP FUNCTION device_history;
DROP TYPE LocationPermissionState;

