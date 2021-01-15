use log::info;
use lib::http_gateway::handlers::rocket;

fn main() {
    env_logger::init();
    info!("starting");
    rocket().launch();
}
