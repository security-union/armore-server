-- migrate:up
create type users_to_migrate_2 as (username varchar(255));

CREATE OR REPLACE FUNCTION return_users_that_require_migration() RETURNS SETOF users_to_migrate_2 AS $$
declare
    rec users_to_migrate_2;
BEGIN
    for rec in
        SELECT derived.username FROM (
            SELECT username from users
                EXCEPT
            SELECT username
            from users_settings
        ) as derived
    loop
        return next rec;
    end loop;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION migrate_users_to_users_settings_and_users_state() RETURNS VOID AS $$
DECLARE
strs users_to_migrate_2;
BEGIN
 FOR strs IN
     (SELECT username FROM public.return_users_that_require_migration())
     LOOP
     INSERT INTO users_settings (username, followers_to_declare_emergency) VALUES (strs.username, 2);
     INSERT INTO users_state (username, self_perception) VALUES (strs.username, 'Normal');
 end loop;
 END;

$$ LANGUAGE plpgsql;

SELECT * from migrate_users_to_users_settings_and_users_state();

-- migrate:down
DROP FUNCTION return_users_that_require_migration;
DROP FUNCTION migrate_users_to_users_settings_and_users_state;

