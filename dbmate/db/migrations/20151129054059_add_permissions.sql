-- migrate:up

insert into devices (device_id, role, name) values ('b526979c-cade-4198-8fa4-fb077ef7544f', 'garage_door', 'Left garage door');
insert into devices (device_id, role, name) values ('b526979c-cade-4198-8fa4-fb077ef7544g', 'garage_door', 'Right garage door');

insert into users_devices (username, device_id, owner, access_enabled) values ('louisck','b526979c-cade-4198-8fa4-fb077ef7544f', true, true);
insert into users_devices (username, device_id, owner, access_enabled) values ('billburr','b526979c-cade-4198-8fa4-fb077ef7544g', true, true);

insert into users_devices (username, device_id, owner, access_enabled) values ('dario','b526979c-cade-4198-8fa4-fb077ef7544f', false, true);
insert into users_devices (username, device_id, owner, access_enabled) values ('dario','b526979c-cade-4198-8fa4-fb077ef7544g', false, true);


-- migrate:down
