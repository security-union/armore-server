-- migrate:up
CREATE TYPE OS AS ENUM ('Android', 'iOS', 'UNKNOWN');

ALTER TABLE devices ADD os OS DEFAULT 'UNKNOWN';
ALTER TABLE devices ADD os_version varchar(50) DEFAULT 'UNKNOWN';
ALTER TABLE devices ADD model varchar(50) DEFAULT 'UNKNOWN';

-- migrate:down
ALTER TABLE devices DROP COLUMN os;
ALTER TABLE devices DROP COLUMN os_version;
ALTER TABLE devices DROP COLUMN model;
