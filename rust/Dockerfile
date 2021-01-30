FROM securityunion/rust-dev:latest

WORKDIR /app

COPY src /app/src
COPY tests /app/tests
COPY *.toml /app/
COPY Cargo.lock .

STOPSIGNAL SIGINT