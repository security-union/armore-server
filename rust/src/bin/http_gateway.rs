#[macro_use]
extern crate log;

use lib::server::http_gateway::rocket;
use lib::server::middleware::logging;
use rocket_sentry_logger::{self as logger, InitConfig};

fn main() {
    env_logger::init();
    match std::env::var("SENTRY_DSN") {
        Ok(dsn) => {
            let sentry_logger = logger::init(dsn, Some(InitConfig {
                service: Some("Http gateway"),
                ..Default::default()
            }));
            rocket()
                .manage(sentry_logger)
                .attach(logger::fairing())
                .attach(logging::api_json_response_fairing())
                .launch();
        },
        Err(_) => {
            debug!("SENTRY_DSN env var not found so not using sentry.");
            rocket().launch();
        }
    }
}

