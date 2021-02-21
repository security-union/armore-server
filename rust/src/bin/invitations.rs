use lib::server::invitations::rocket;
use lib::server::middleware::logging;
use rocket_sentry_logger::{self as logger, InitConfig};
fn main() {
    let guard = logger::init(Some(InitConfig {
        service: Some("Invitations API"),
        ..Default::default()
    }));
    env_logger::init();
    rocket()
        .manage(guard)
        .attach(logger::fairing())
        .attach(logging::api_json_response_fairing())
        .launch();
}
