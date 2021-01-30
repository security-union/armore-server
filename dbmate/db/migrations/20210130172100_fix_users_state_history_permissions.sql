-- migrate:up

GRANT SELECT ON ALL TABLES IN SCHEMA public TO app;
GRANT INSERT ON ALL TABLES IN SCHEMA public TO app;

-- migrate:down

