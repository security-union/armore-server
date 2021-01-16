-- migrate:up
INSERT INTO users_settings (username) VALUES ('dario');
INSERT INTO users_state (username) VALUES ('dario');

-- migrate:down
