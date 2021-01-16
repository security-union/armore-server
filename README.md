<h1 align="center">Welcome to Armore server 👋</h1>
<p>
</p>

> Armore App Backend. A distributed system built with Rust and Node

### 🏠 [Homepage](https://armore.dev/)

## Configure

Make sure that you have **Docker** & **Docker Compose** installed on your system so you can easily follow the next steps!

Before running the project, first copy the .env.save file:

```bash
$ cp .env.save .env
```

## Run

We provide you with a set of tools that can help you to automate the building and running process throughout makefiles and docker-compose files.

```bash
$ make build_and_run # This command builds and run the docker containers
# remember to execute `make down` when you are done
```

## Test ✅

### Node Server

```bash
$ cd server
$ make tests_run
```

### Rust Server

```bash
$ cd server_rust
$ make tests_local_run
```

This is going to run all the tests inside a docker environment.
If you want to have more control over how the tests are performed, you can run:
### Node Server

```bash
$ cd server
$ make tests_up

    > $ npm run test-backend # ex.
```

### Rust Server

```bash
$ cd server_rust
$ make tests_local_up

    > $ cargo test -- --test-threads=1 # ex.
```

## 👤 Contributors ✨

<table>
<tr>
<td align="center"><a href="https://github.com/darioalessandro"><img src="https://avatars0.githubusercontent.com/u/1176339?s=400&v=4" width="100" alt=""/><br /><sub><b>Dario</b></sub></a></td>
<td align="center"><a href="https://github.com/griffobeid"><img src="https://avatars1.githubusercontent.com/u/12220672?s=400&u=639c5cafe1c504ee9c68ad3a5e09d1b2c186462c&v=4" width="100" alt=""/><br /><sub><b>Griffin Obeid</b></sub></a></td>    
<td align="center"><a href="https://github.com/JasterV"><img src="https://avatars3.githubusercontent.com/u/49537445?v=4" width="100" alt=""/><br /><sub><b>Victor Martínez</b></sub></a></td>
</tr>
</table>

## Show your support

Give a ⭐️ if this project helped you!
