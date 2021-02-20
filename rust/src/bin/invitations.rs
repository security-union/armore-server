use lib::server::invitations::rocket;
use lib::server::middleware::logging;
use rocket_sentry_logger as logger;

fn main() {
    env_logger::init();
    let _guard = logger::init();
    rocket()
        .attach(logger::fairing())
        .attach(logging::api_json_response_fairing(Some("invitations")))
        .launch();
}
