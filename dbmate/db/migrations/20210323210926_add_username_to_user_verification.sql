-- migrate:up
ALTER TABLE users_verification ADD COLUMN username character varying(255);
;
UPDATE users_verification SET username = 'INVALID_ID';
ALTER TABLE users_verification ADD CONSTRAINT users_verification_username_constraint CHECK (username is not null);
ALTER TABLE users_verification DROP CONSTRAINT users_verification_email_fkey;

-- migrate:down
ALTER TABLE users_verification DROP COLUMN username;
ALTER TABLE users_verification DROP CONSTRAINT users_verification_username_constraint;
ALTER TABLE users_verification ADD CONSTRAINT users_verification_email_fkey FOREIGN KEY (email) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE;
