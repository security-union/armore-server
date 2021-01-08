select email
from devices
         inner join users_devices on devices.device_id = users_devices.device_id
         inner join users on users_devices.username = users.username
where owner = true
  and os = 'iOS';
