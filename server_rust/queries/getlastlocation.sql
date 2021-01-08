select username, recipient_username, creation_timestamp
from device_telemetry
where username = 'chelito'
order by creation_timestamp desc;
