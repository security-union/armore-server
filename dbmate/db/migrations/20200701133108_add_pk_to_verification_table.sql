-- migrate:up
ALTER TABLE users_verification ADD public_key TEXT NOT NULL;

-- migrate:down
ALTER TABLE users_verification DROP COLUMN public_key;
