-- migrate:up

CREATE TABLE users_state_history (
    username varchar(255) NOT NULL,
    self_perception UserState NOT NULL DEFAULT 'Normal',
    creation_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (username, creation_timestamp),
    CONSTRAINT fk_users_state 
        FOREIGN KEY (username) 
        REFERENCES users_state(username) 
        ON DELETE CASCADE
);

CREATE FUNCTION users_state_history() RETURNS trigger AS $users_state_trigger$
    BEGIN
        INSERT INTO users_state_history SELECT NEW.username, NEW.self_perception;
        RETURN NULL;
    END;
$users_state_trigger$ LANGUAGE plpgsql;

CREATE TRIGGER users_state_trigger AFTER INSERT OR UPDATE ON users_state
    FOR EACH ROW EXECUTE PROCEDURE users_state_history();

-- migrate:down

DROP TRIGGER IF EXISTS users_state_history on user_state;

DROP FUNCTION users_state_history;

DROP TABLE users_state_history;


