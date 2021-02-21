use lib::server::emergency::rocket;
use rocket_sentry_logger as logger;
fn main() {
    let guard = logger::init();
    env_logger::init();
    rocket()
    .manage(guard)
    .launch();
}

