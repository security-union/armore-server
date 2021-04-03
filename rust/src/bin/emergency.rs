use lib::server::emergency::rocket;
use log::debug;
use rocket_sentry_logger::{self as logger, InitConfig};

fn main() {
    env_logger::init();
    match std::env::var("SENTRY_DSN") {
        Ok(dsn) => {
            let sentry_logger = logger::init(
                dsn,
                Some(InitConfig {
                    service: Some("Emergency API"),
                    ..Default::default()
                }),
            );
            rocket()
                .manage(sentry_logger)
                .attach(logger::fairing())
                .launch();
        }
        Err(_) => {
            debug!("SENTRY_DSN env var not found so not using sentry.");
            rocket().launch();
        }
    }
}
