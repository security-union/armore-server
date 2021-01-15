-- migrate:up
ALTER TABLE user_details ADD language varchar(50) DEFAULT 'en' NOT NULL;

-- migrate:down
ALTER TABLE user_details DROP COLUMN language;
