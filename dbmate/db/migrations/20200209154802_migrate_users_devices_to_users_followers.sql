-- migrate:up
create type user_and_follower as (username varchar(255), username_follower varchar(255));

CREATE OR REPLACE FUNCTION return_users_devices_that_require_migration() RETURNS SETOF user_and_follower AS $$
declare
    rec user_and_follower;
BEGIN
    for rec in
        SELECT derived.username, derived.username_follower FROM (
              SELECT DISTINCT ud2.username, ud1.username AS username_follower
              FROM users_devices AS ud1
                       INNER JOIN users_devices AS ud2
                                  ON ud1.device_id = ud2.device_id and ud1.owner = false and ud2.owner = true
                  EXCEPT
              SELECT username, username_follower
              from users_followers
        ) as derived
    loop
        return next rec;
    end loop;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION migrate_users_to_users_access() RETURNS VOID AS $$
DECLARE
strs user_and_follower;
BEGIN
 FOR strs IN
     (SELECT username, username_follower FROM public.return_users_devices_that_require_migration())
     LOOP
     INSERT INTO users_followers (username, username_follower, access_type, is_emergency_contact) VALUES (strs.username, strs.username_follower, 'Permanent', true);
     INSERT INTO users_followers_state (username, username_follower, follower_perception) VALUES (strs.username, strs.username_follower, 'Normal');
 end loop;
 END;

$$ LANGUAGE plpgsql;

SELECT * from migrate_users_to_users_access();


-- migrate:down
DROP FUNCTION return_users_devices_that_require_migration;
DROP FUNCTION migrate_users_to_users_access;

