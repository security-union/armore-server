-- migrate:up
create table device_locations (
  username varchar(255) NOT NULL,
  device_id varchar(255) NOT NULL,
  location point NOT NULL,
  creation_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- migrate:down
DROP TABLE device_locations;
