-- migrate:up

ALTER TABLE invitations ADD COLUMN target_phone_number varchar(25);

-- migrate:down

ALTER TABLE invitations DROP COLUMN target_phone_number;
