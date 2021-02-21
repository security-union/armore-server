use lib::server::http_gateway::rocket;

fn main() {
    env_logger::init();
    rocket().launch();
}
