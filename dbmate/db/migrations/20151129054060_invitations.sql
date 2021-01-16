-- migrate:up
CREATE TYPE invitation_status AS ENUM ('created', 'accepted', 'rejected', 'canceled');
CREATE TYPE invitation_type AS ENUM ('device');

CREATE TABLE invitations (
  id UUID,
  creator_username varchar(255) REFERENCES users(username),
  target_username varchar(255) REFERENCES users(username),
  status invitation_status NOT NULL,
  invitation jsonb NOT NULL,
  type invitation_type NOT NULL,
  creation_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE users_devices ADD permissions jsonb;

UPDATE users_devices SET permissions = '{"permanentAccess": true}'::jsonb WHERE username = 'dario' and device_id = 'b526979c-cade-4198-8fa4-fb077ef7544f';
UPDATE users_devices SET permissions = '{"permanentAccess": true}'::jsonb WHERE username = 'dario' and device_id = 'b526979c-cade-4198-8fa4-fb077ef7544g';

-- migrate:down
DROP TABLE invitations;
DROP TYPE invitation_status;
DROP TYPE invitation_type;

ALTER TABLE users_devices DROP COLUMN permissions;
