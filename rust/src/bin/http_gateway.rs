use log::info;
use lib::server::http_gateway::rocket;

fn main() {
    env_logger::init();
    info!("starting");
    rocket().launch();
}
