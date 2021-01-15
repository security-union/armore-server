-- migrate:up

CREATE TYPE link_invitation_state AS ENUM ('CREATED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

CREATE TABLE link_invitations (
  id varchar(255) PRIMARY KEY,
  state link_invitation_state NOT NULL DEFAULT 'CREATED',
  creation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiration_timestamp TIMESTAMP NOT NULL,
  creator_username VARCHAR(255) NOT NULL,
  recipient_username VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY(creator_username)
  REFERENCES users(username)
  ON DELETE CASCADE,
  FOREIGN KEY(recipient_username)
  REFERENCES users(username)
  ON DELETE CASCADE
);

-- migrate:down
DROP TABLE link_invitations;
DROP TYPE link_invitation_state;