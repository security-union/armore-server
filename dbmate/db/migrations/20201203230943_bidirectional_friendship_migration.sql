-- migrate:up
CREATE PROCEDURE follow_user(usernameA VARCHAR(255), username_followerA VARCHAR(255))
LANGUAGE SQL
AS $$
INSERT INTO users_followers(username, username_follower, access_type, is_emergency_contact)
    VALUES (usernameA, username_followerA, 'Permanent', true);
INSERT INTO users_followers_state(username, username_follower)
    VALUES (usernameA, username_followerA);
$$;

CREATE OR REPLACE FUNCTION unidirectional_to_bidirectional()
RETURNS void
AS $$
DECLARE
    f RECORD;
BEGIN                                                 
    FOR f IN SELECT username_follower, username FROM users_followers AS unidirectional_friends
        EXCEPT
        SELECT uf1.username_follower, uf1.username
        FROM users_followers AS uf1
            RIGHT JOIN users_followers AS uf2 ON uf1.username=uf2.username_follower
    LOOP
        CALL follow_user(f.username_follower, f.username);
    END LOOP;
END;
$$
LANGUAGE plpgsql;

SELECT * FROM unidirectional_to_bidirectional();

-- migrate:down

DROP FUNCTION unidirectional_to_bidirectional;
DROP PROCEDURE follow_user;
