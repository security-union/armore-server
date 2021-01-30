-- migrate:up


DO
$do$
BEGIN
    IF EXISTS (
        SELECT FROM pg_catalog.pg_roles
        WHERE  rolname = 'app'
    ) THEN
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO app;
        GRANT INSERT ON ALL TABLES IN SCHEMA public TO app;
    END IF;
END
$do$;

-- migrate:down

