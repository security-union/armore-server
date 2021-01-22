use lib::constants::ASIMOV_LIVES;
use lib::invitations::handlers::rocket;
use rocket::local::Client;
use rocket::http::{Header, Status};

mod common;
use common::dbmate::dbmate_rebuild;

#[test]
fn test_auth_info() {
    dbmate_rebuild();
    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.post("/v1/invitations");

    request.add_header(Header::new("Content-Type", "application/json"));
    request.add_header(Header::new(ASIMOV_LIVES, ""));

    let response = request.dispatch();
    assert_eq!(response.status(), Status::Forbidden);
}
