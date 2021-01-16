tests_up:
	docker-compose up -d --scale rust-tests=0 && docker-compose run rust-tests /bin/bash

tests_run:
	docker-compose up -d --scale rust-tests=0 && docker-compose run rust-tests cargo test -- --test-threads=1

tests_down:
	docker-compose down

tests_build:
	docker-compose build
