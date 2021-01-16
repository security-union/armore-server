-- migrate:up
CREATE TYPE Command AS ENUM ('RefreshTelemetry');
CREATE TYPE CommandState AS ENUM ('Created', 'Completed', 'Error');

create table commands
(
    username           varchar(255) NOT NULL,
    recipient_username varchar(255),
    request            text,
    request_timestamp  TIMESTAMP    NOT NULL,
    response           text,
    response_timestamp TIMESTAMP,
    correlation_id     varchar(255),
    type               Command      NOT NULL,
    state              CommandState NOT NULL
);
-- migrate:down
DROP TABLE commands;
