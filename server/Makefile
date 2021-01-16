build_and_run: 
	docker-compose build && docker-compose up

prune_volumes_build_and_run:
	docker volume prune
	docker-compose build && docker-compose up

tests_up:
	docker-compose -f docker-compose-test.yaml up -d --scale test=0 && docker-compose -f docker-compose-test.yaml run test /bin/sh

tests_down:
	docker-compose -f docker-compose-test.yaml down

tests_build:
	docker-compose -f docker-compose-test.yaml build

tests_run:
	docker-compose -f docker-compose-test.yaml up -d --scale test=0 && docker-compose -f docker-compose-test.yaml run test yarn test-backend

prune_images:
	docker system prune
