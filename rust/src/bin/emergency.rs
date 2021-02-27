use lib::server::emergency::rocket;

fn main() {
    env_logger::init();
    rocket().launch();
}
