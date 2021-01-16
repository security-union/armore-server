tests_local_up:
	docker-compose -f docker-compose-test-local.yaml up -d && docker-compose -f docker-compose-test-local.yaml exec rust-tests /bin/bash

tests_local_run:
	docker-compose -f docker-compose-test-local.yaml up -d && docker-compose -f docker-compose-test-local.yaml exec rust-tests cargo test -- --test-threads=1

tests_local_down:
	docker-compose -f docker-compose-test-local.yaml down

tests_local_build:
	docker-compose -f docker-compose-test-local.yaml build


