-- migrate:up

create table users_followers_state (
  username varchar(255) NOT NULL,
  username_follower varchar(255) NOT NULL,
  follower_perception UserState NOT NULL DEFAULT 'Normal',
  creation_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(username, username_follower),
  FOREIGN KEY(username, username_follower) REFERENCES users_followers(username, username_follower) ON DELETE CASCADE
);

-- migrate:down
drop table users_followers_state;

