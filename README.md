<p align="center" >
  <img src="docs/marketing/icon.svg" title="Armore" width="200" float=left>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-1.0-blue.svg?cacheSeconds=2592000" />
  <a href="./LICENSE" target="_blank">
    <img alt="License: APACHE License" src="https://img.shields.io/badge/license-Apache--2.0-green" />
  </a>
  <img alt="rust-build" src="https://img.shields.io/github/workflow/status/security-union/armore-server/Rust?logo=Rust" />
  <img alt="node-build" src="https://img.shields.io/github/workflow/status/security-union/armore-server/NodeJS?logo=node.js" />
  <img alt="pr" src="https://img.shields.io/github/issues-pr/security-union/armore-server" />
  <img alt="issues" src="https://img.shields.io/github/issues/security-union/armore-server" />
</p>

<h1 align="center">Armore: Find Family, Friends</h1>
<h2 align="center">Armore is the e2e encrypted location sharing app available for iOS and other mobile platforms.</h2>


<p align="center">
<a href="https://apps.apple.com/us/app/id1515585896" rel="App Store Link">
    <img src="docs/marketing/apple_app_store_badge.svg" width="200" title="App Store" float=left>
</a>
<a href="https://play.google.com/store/apps/details?id=com.blackfire.android" rel="Google Play Link">
    <img src="docs/marketing/google-play-badge.svg" width="200" title="Google Play" float=left>
</a>
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
$ docker-compose up --build -d
# remember to execute `make down` when you are done
```

## Test ✅

### Node Server

```bash
$ cd nodejs
$ make tests_run
```

### Rust Server

```bash
$ cd rust
$ make tests_run
```

This is going to run all the tests inside a docker environment.
If you want to have more control over how the tests are performed, you can run:
### Node Server

```bash
$ cd nodejs
$ make tests_up

    > $ yarn test-backend # ex.
```

### Rust Server

```bash
$ cd rust
$ make tests_up

    > $ cargo test -- --test-threads=1 # Tests must run in serial. https://securityunion.atlassian.net/browse/ARM-157
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
