-- migrate:up
create table device_telemetry (
    username varchar(255) NOT NULL,
    recipient_username varchar(255) NOT NULL,
    encrypted_location TEXT NOT NULL,
    device_id varchar(255) NOT NULL,
    creation_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE,
    FOREIGN KEY(recipient_username) REFERENCES users(username) ON DELETE CASCADE
);

-- migrate:down
DROP TABLE device_telemetry;
