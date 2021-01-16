-- migrate:up

create table users_settings (
  username varchar(255) NOT NULL,
  followers_to_declare_emergency smallint NOT NULL DEFAULT 2,
  creation_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(username),
  FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
);

-- migrate:down
drop table users_settings;
