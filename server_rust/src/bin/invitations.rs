use lib::invitations::handlers::rocket;

fn main() {
    env_logger::init();
    rocket().launch();
}