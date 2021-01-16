-- migrate:up

ALTER TABLE users_verification ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users_verification ADD COLUMN phone_number varchar(25) DEFAULT NULL;
ALTER TABLE users_verification ADD CONSTRAINT phone_or_email_constraint CHECK (phone_number is not null OR email is not null);

-- migrate:down

ALTER TABLE users_verification DROP COLUMN phone_number
ALTER TABLE users_verification ALTER COLUMN email SET NOT NULL
ALTER TABLE users_verification DROP CONSTRAINT phone_or_email_constraint;