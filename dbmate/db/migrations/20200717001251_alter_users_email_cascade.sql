-- migrate:up

ALTER TABLE users_verification DROP CONSTRAINT users_verification_email_fkey;
ALTER TABLE users_verification ADD CONSTRAINT users_verification_email_fkey FOREIGN KEY (email) REFERENCES users(email) ON UPDATE CASCADE ON DELETE CASCADE;

-- migrate:down
ALTER TABLE users_verification DROP CONSTRAINT users_verification_email_fkey;
ALTER TABLE users_verification ADD CONSTRAINT users_verification_email_fkey FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE;
