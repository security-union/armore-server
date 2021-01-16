-- migrate:up
create table users_geofences (
  geofence_id serial NOT NULL,
  username varchar(255) NOT NULL,
  PRIMARY KEY(geofence_id, username)
);

insert into users_geofences (geofence_id, username) values (1, 'dario');
insert into users_geofences (geofence_id, username) values (1, 'griffin');
insert into users_geofences (geofence_id, username) values (1, 'coche');
insert into users_geofences (geofence_id, username) values (2, 'dario');
insert into users_geofences (geofence_id, username) values (2, 'griffin');
insert into users_geofences (geofence_id, username) values (2, 'coche');
insert into users_geofences (geofence_id, username) values (3, 'dario');
insert into users_geofences (geofence_id, username) values (3, 'griffin');
insert into users_geofences (geofence_id, username) values (3, 'coche');

-- migrate:down
drop table users_geofences;
