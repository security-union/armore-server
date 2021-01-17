tests_up:
	docker-compose up -d --scale test=0 && docker-compose run test /bin/sh

tests_down:
	docker-compose down

tests_build:
	docker-compose build

tests_run:
	docker-compose up -d --scale test=0 && docker-compose run test yarn test-backend
