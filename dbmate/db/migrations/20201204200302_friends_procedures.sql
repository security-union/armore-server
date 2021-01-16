-- migrate:up

CREATE PROCEDURE add_friend(usernameA VARCHAR(255), usernameB VARCHAR(255))
LANGUAGE SQL
AS $$
INSERT INTO users_followers(username, username_follower, access_type, is_emergency_contact)
    VALUES (usernameA, usernameB, 'Permanent', true);
INSERT INTO users_followers_state(username, username_follower)
    VALUES (usernameA, usernameB);
INSERT INTO users_followers(username, username_follower, access_type, is_emergency_contact)
    VALUES (usernameB, usernameA, 'Permanent', true);
INSERT INTO users_followers_state(username, username_follower)
    VALUES (usernameB, usernameA);
$$;

CREATE PROCEDURE remove_friend(usernameA VARCHAR(255), usernameB VARCHAR(255))
LANGUAGE SQL
AS $$
DELETE FROM users_followers 
    WHERE username IN (usernameA, usernameB) AND username_follower IN (usernameA, usernameB);
DELETE FROM users_followers_state 
    WHERE username IN (usernameA, usernameB) AND username_follower IN (usernameA, usernameB);
$$;



-- migrate:down

DROP PROCEDURE add_friend;
DROP PROCEDURE remove_friend;
