-- migrate:up
create table users_identity (
    username varchar(255) NOT NULL,
    public_key TEXT NOT NULL,
    creation_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(username),
    FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
);

-- migrate:down
DROP TABLE users_identity;
