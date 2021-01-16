-- migrate:up

CREATE TYPE AccessType AS ENUM ('Permanent', 'EmergencyOnly');
CREATE TYPE CrudAction AS ENUM ('Insert', 'Update', 'Delete');

create table users_followers (
  username varchar(255) NOT NULL,
  username_follower varchar(255) NOT NULL,
  access_type AccessType NOT NULL DEFAULT 'EmergencyOnly',
  is_emergency_contact BOOLEAN NOT NULL DEFAULT false,
  creation_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(username, username_follower),
  FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE,
  FOREIGN KEY(username_follower) REFERENCES users(username) ON DELETE CASCADE
);

-- migrate:down
drop table users_followers;
