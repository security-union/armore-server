use lib::server::http_gateway::rocket;
use log::info;

fn main() {
    env_logger::init();
    info!("starting");
    rocket().launch();
}
