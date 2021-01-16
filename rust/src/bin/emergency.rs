use lib::emergency::handlers::rocket;

fn main() {
    env_logger::init();
    rocket().launch();
}