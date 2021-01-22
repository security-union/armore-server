use lib::server::invitations::rocket;

fn main() {
    env_logger::init();
    rocket().launch();
}