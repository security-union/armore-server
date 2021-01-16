-- migrate:up

ALTER TABLE invitations DROP CONSTRAINT invitations_creator_username_fkey;
ALTER TABLE invitations ADD CONSTRAINT invitations_creator_username_fkey FOREIGN KEY (creator_username) REFERENCES users(username) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE invitations DROP CONSTRAINT invitations_target_username_fkey;
ALTER TABLE invitations ADD CONSTRAINT invitations_target_username_fkey FOREIGN KEY (target_username) REFERENCES users(username) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE user_details ADD CONSTRAINT user_details_target_username_fkey FOREIGN KEY(username) REFERENCES users(username) ON UPDATE CASCADE ON DELETE CASCADE;

-- Delete old users_devices

ALTER TABLE users_devices ADD CONSTRAINT users_devices_target_username_fkey FOREIGN KEY(username) REFERENCES users(username) ON UPDATE CASCADE ON DELETE CASCADE;

-- migrate:down
ALTER TABLE invitations DROP CONSTRAINT invitations_creator_username_fkey;
ALTER TABLE invitations ADD CONSTRAINT invitations_creator_username_fkey FOREIGN KEY (creator_username) REFERENCES users(username);

ALTER TABLE invitations DROP CONSTRAINT invitations_target_username_fkey;
ALTER TABLE invitations ADD CONSTRAINT invitations_target_username_fkey FOREIGN KEY (target_username) REFERENCES users(username);

ALTER TABLE user_details DROP CONSTRAINT user_details_target_username_fkey;

ALTER TABLE users_devices DROP CONSTRAINT users_devices_target_username_fkey;
