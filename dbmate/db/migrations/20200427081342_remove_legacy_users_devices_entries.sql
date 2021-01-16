-- migrate:up
DELETE from users_devices where device_id = 'dario_android' and username = 'dario';
DELETE from users_devices where device_id = 'b526979c-cade-4198-8fa4-fb077ef7544g' and username = 'dario';
DELETE from users_devices where device_id = 'b526979c-cade-4198-8fa4-fb077ef7544f' and username = 'dario';

DELETE from devices where device_id = 'dario_android';

-- migrate:down
