-- migrate:up
ALTER TABLE users DROP COLUMN password;
drop table password_reset;

-- migrate:down
ALTER TABLE users ADD public_key varchar(255) NOT NULL;
create table password_reset (
                                id UUID,
                                username varchar(255) NOT NULL,
                                used BOOLEAN NOT NULL,
                                creation_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                updated_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                expiration_timestamp timestamp NOT NULL,
                                PRIMARY KEY (id)
);

