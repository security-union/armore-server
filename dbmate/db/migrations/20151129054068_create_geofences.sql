-- migrate:up
create table geofences (
  geofence_id serial,
  device_id varchar(255) NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  radius smallint NOT NULL,
  active boolean NULL,
  PRIMARY KEY(geofence_id, device_id)
);

insert into geofences (device_id, lat, lon, radius, active) values ('griffin_iphone', 42.2933922, -83.68552609999999, 50, false);
insert into geofences (device_id, lat, lon, radius, active) values ('dario_iphone', 42.281659, -83.749949, 25, false);
insert into geofences (device_id, lat, lon, radius, active) values ('coche_iphone', 42.3314, -83.0458, 150, false);

-- migrate:down
drop table geofences;
