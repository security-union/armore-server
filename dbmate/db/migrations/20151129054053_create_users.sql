-- migrate:up
create table users (
  username varchar(255) PRIMARY KEY,
  password varchar(255) NOT NULL,
  email varchar(255) NOT NULL UNIQUE
);

insert into users (username, password, email) values ('dario', 'FGU2OHgynOZU4s8vcK4hSNutW8ik3e8OKOYwomY2tMI=', 'darioalessandrolencina@gmail.com');
insert into users (username, password, email) values ('coche', 'FGU2OHgynOZU4s8vcK4hSNutW8ik3e8OKOYwomY2tMI=', 'luiscoche9@gmail.com');
insert into users (username, password, email) values ('louisck', 'FGU2OHgynOZU4s8vcK4hSNutW8ik3e8OKOYwomY2tMI=', 'darioalessandro.lencina@gmail.com');
insert into users (username, password, email) values ('billburr', 'FGU2OHgynOZU4s8vcK4hSNutW8ik3e8OKOYwomY2tMI=', 'darioalessandro.l.encina@gmail.com');

-- migrate:down
drop table users;
