-- migrate:up
ALTER TABLE users DROP CONSTRAINT phone_or_email_constraint;

-- migrate:down
ALTER TABLE users ADD CONSTRAINT phone_or_email_constraint CHECK (phone_number is not null OR email is not null);
