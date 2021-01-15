-- migrate:up
create table password_reset (
    id UUID,
    username varchar(255) NOT NULL,
    used BOOLEAN NOT NULL,
    creation_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expiration_timestamp timestamp NOT NULL,
    PRIMARY KEY (id)
);

-- migrate:down
drop table password_reset;
