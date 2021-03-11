use lib::server::invitations::rocket;
use lib::server::middleware::logging;
use rocket_sentry_logger::{self as logger, InitConfig};

fn main() {
    let dsn = std::env::var("SENTRY_DSN");
    if let Ok(dsn) = dsn {
        let _guard = logger::init(
            dsn,
            Some(InitConfig {
                service: Some("Invitations API"),
                ..Default::default()
            }),
        );
    }
    env_logger::init();
    rocket()
        .attach(logger::fairing())
        .attach(logging::api_json_response_fairing())
        .launch();
}
