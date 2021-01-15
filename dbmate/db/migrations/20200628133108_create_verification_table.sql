-- migrate:up
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

create table users_verification
(
    verification_id         uuid DEFAULT uuid_generate_v4(),
    verification_code       char(5) NOT NULL,
    email                   varchar(255) NOT NULL,
    used                    BOOLEAN NOT NULL,
    creation_timestamp      TIMESTAMP NOT NULL,
    updated_timestamp       TIMESTAMP NOT NULL,
    expiration_timestamp    TIMESTAMP NOT NULL,
    PRIMARY KEY (verification_id),
    FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
);

-- migrate:down
DROP TABLE users_verification;
