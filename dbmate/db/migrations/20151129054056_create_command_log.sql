-- migrate:up
create table command_log (
  username varchar(255),
  device_id varchar(255),
  request text,
  request_timestamp timestamp,
  response text,
  response_timestamp timestamp,
  correlation_id varchar(255)
);

insert into command_log (username, device_id, request, response, request_timestamp, response_timestamp) values 
  ('dario', 'dario_garage', '', '', '2019-06-11 19:10:25-04', '2019-06-11 19:10:26-04');

-- migrate:down
drop table command_log;
