-- migrate:up
ALTER TABLE invitations ADD target_email varchar(255);
-- migrate:down
