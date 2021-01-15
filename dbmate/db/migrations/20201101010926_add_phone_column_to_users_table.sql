-- migrate:up

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN phone_number varchar(25) UNIQUE;
ALTER TABLE users ADD CONSTRAINT phone_or_email_constraint CHECK (phone_number is not null OR email is not null);

-- migrate:down

ALTER TABLE users DROP COLUMN phone_number
ALTER TABLE users ALTER COLUMN email SET NOT NULL
ALTER TABLE users DROP CONSTRAINT phone_or_email_constraint;