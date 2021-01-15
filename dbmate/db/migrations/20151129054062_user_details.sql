-- migrate:up
create table user_details (
  username varchar(255) PRIMARY KEY,
  first_name varchar(255) NOT NULL,
  last_name varchar(255) NOT NULL,
  picture varchar(255),
  creation_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_timestamp timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

insert into user_details (username, first_name, last_name, picture, creation_timestamp, updated_timestamp) 
values ('dario', 'Dario', 'Lencina-Talarico', 'https://www.theyucatantimes.com/wp-content/uploads/2017/11/AMLO-150x125.jpg', now(), now());

insert into user_details (username, first_name, last_name, picture, creation_timestamp, updated_timestamp) 
values ('coche', 'Coche', 'Rodríguez', 'https://ccco.s3.amazonaws.com/vehicles/images/2/0/3/7/3/9/203739/4088154_b974ba354f_small.JPG', now(), now());

insert into user_details (username, first_name, last_name, picture, creation_timestamp, updated_timestamp) 
values ('louisck', 'Louis', 'CK', 'https://www.theyucatantimes.com/wp-content/uploads/2017/11/AMLO-150x125.jpg', now(), now());

insert into user_details (username, first_name, last_name, picture, creation_timestamp, updated_timestamp) 
values ('billburr', 'Bill', 'Burr', 'https://www.theyucatantimes.com/wp-content/uploads/2017/11/AMLO-150x125.jpg', now(), now());


-- migrate:down
DROP TABLE user_details;
