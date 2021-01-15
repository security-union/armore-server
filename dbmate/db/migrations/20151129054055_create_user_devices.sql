-- migrate:up

create table users_devices (
  username varchar(255) NOT NULL,
  device_id varchar(255) NOT NULL,
  owner BOOLEAN NOT NULL,
  access_enabled BOOLEAN NOT NULL,
  PRIMARY KEY(username, device_id)
);

insert into users_devices (username, device_id, owner, access_enabled) values ('dario','dario_iphone', true, true);
insert into users_devices (username, device_id, owner, access_enabled) values ('dario','dario_android', true, true);
insert into users_devices (username, device_id, owner, access_enabled) values ('coche','coche_iphone', true, true);

-- migrate:down
drop table users_devices;
