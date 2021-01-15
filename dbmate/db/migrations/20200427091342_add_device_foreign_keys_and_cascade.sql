-- migrate:up
ALTER TABLE users_devices
    ADD CONSTRAINT unique_device_id
        unique(device_id);

ALTER TABLE devices
    ADD CONSTRAINT fk_users_devices_device_id
        FOREIGN KEY (device_id)
            REFERENCES users_devices(device_id)
            ON DELETE CASCADE;

-- migrate:down
ALTER TABLE devices DROP CONSTRAINT fk_users_devices_device_id;
ALTER TABLE users_devices DROP CONSTRAINT unique_device_id;
