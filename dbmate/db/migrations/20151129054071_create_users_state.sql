-- migrate:up

CREATE TYPE UserState AS ENUM ('Normal', 'Emergency');

create table users_state (
  username varchar(255) NOT NULL,
  self_perception UserState NOT NULL DEFAULT 'Normal',
  creation_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(username),
  FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
);

-- migrate:down
drop table users_state;
