-- migrate:up
create table devices (
  device_id varchar(255) PRIMARY KEY,
  role varchar(255) NOT NULL,
  name varchar(255) NOT NULL
);

insert into devices (device_id, role, name) values ('dario_iphone', 'phone', 'dario_iphone');
insert into devices (device_id, role, name) values ('dario_android', 'phone', 'dario_android');
insert into devices (device_id, role, name) values ('coche_iphone', 'phone', 'coche_iphone');

-- migrate:down
drop table devices;
