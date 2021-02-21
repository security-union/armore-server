use lib::server::http_gateway::rocket;
use rocket_sentry_logger as logger;
fn main() {
    let guard = logger::init();
    env_logger::init();
    rocket()
    .manage(guard)
    .launch();
}
