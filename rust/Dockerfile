FROM securityunion/rust-dev:latest

RUN rustup default nightly-2021-02-25
RUN rustup component add rustfmt

WORKDIR /app

COPY src /app/src
COPY tests /app/tests
COPY *.toml /app/
COPY Cargo.lock .

STOPSIGNAL SIGINT