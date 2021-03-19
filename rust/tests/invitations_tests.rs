use chrono::{Duration, Local};
use lib::constants::ASIMOV_LIVES;
use lib::{db::get_pool, model::invitations::InvitationState};
use regex::Regex;
use rocket::http::{Header, Status};
use rocket::local::Client;
use rocket_contrib::json;

use lib::server::invitations::rocket;
use std::time::SystemTime;

mod common;
use common::{
    auth::{create_token, MOCK_PUBLIC_KEY},
    db::{insert_mock_friends, insert_mock_invitation_link, insert_mock_public_key},
    dbmate::dbmate_rebuild,
};

fn week() -> Duration {
    Duration::days(7)
}

#[test]
fn test_create_invitation_link() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);

    let rocket = rocket();
    let pool = get_pool();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();
    let mut db_client = pool.get().unwrap();
    let expiration_date = Local::now() + week();
    let exp_date = expiration_date.to_rfc3339();
    let re = Regex::new(r#"\{"success":true,"result":\{"link":".*"\}\}"#).unwrap();
    let mut request = client.post("/v1/invitations");

    request.add_header(Header::new("Content-Type", "application/json"));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    request.set_body(json!({ "expirationDate": &exp_date }).to_string());

    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert!(
        re.is_match(&response.body_string().unwrap()),
        "actual {}",
        &response.body_string().unwrap()
    );

    let rows = db_client
        .query(
            "SELECT * FROM link_invitations WHERE expiration_timestamp = $1",
            &[&SystemTime::from(expiration_date)],
        )
        .unwrap();
    assert_eq!(rows.len(), 1)
}

#[test]
fn test_create_invalid_timestamp() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();

    let exp_date = "2018-02-04T04:03:46.597Z";
    let mut request = client.post("/v1/invitations");

    request.add_header(Header::new("Content-Type", "application/json"));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    request.set_body(json!({ "expirationDate": &exp_date }).to_string());

    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        r#"{"result":{"engineeringError":null,"message":"Invalid creation timestamp"},"success":false}"#,
        &response.body_string().unwrap()
    );
}

#[test]
fn test_reject_created_invitation() {
    dbmate_rebuild();
    insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
    let token = create_token("coche", "coche_iphone").unwrap();

    let exp_date = (Local::now() + week()).to_rfc3339();
    let inv_id = "XjKlQptXcAeQ";
    insert_mock_invitation_link("dario", inv_id, &exp_date, InvitationState::CREATED, &None);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.post(format!("/v1/invitations/{}/reject", inv_id));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        r#"{"success":true,"result":{"message":"Ok"}}"#,
        &response.body_string().unwrap()
    );
}

#[test]
fn test_reject_rejected_invitation() {
    dbmate_rebuild();
    insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
    let token = create_token("coche", "coche_iphone").unwrap();

    let exp_date = (Local::now() + week()).to_rfc3339();
    let inv_id = "XjKlQptXcAeQ";
    insert_mock_invitation_link("dario", inv_id, &exp_date, InvitationState::REJECTED, &None);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.post(format!("/v1/invitations/{}/reject", inv_id));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        r#"{"result":{"engineeringError":null,"message":"The invitation is no longer valid"},"success":false}"#,
        &response.body_string().unwrap()
    );
}

#[test]
fn test_reject_expired_invitation() {
    dbmate_rebuild();
    insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
    let token = create_token("coche", "coche_iphone").unwrap();

    let exp_date = (Local::now() - week()).to_rfc3339();
    let inv_id = "XjKlQptXcAeQ";
    insert_mock_invitation_link("dario", inv_id, &exp_date, InvitationState::CREATED, &None);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.post(format!("/v1/invitations/{}/reject", inv_id));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        r#"{"result":{"engineeringError":null,"message":"The invitation is no longer valid"},"success":false}"#,
        &response.body_string().unwrap()
    );
}

#[test]
fn test_reject_own_invitation() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    let token = create_token("dario", "dario_iphone").unwrap();

    let exp_date = (Local::now() + week()).to_rfc3339();
    let inv_id = "XjKlQptXcAeQ";
    insert_mock_invitation_link("dario", inv_id, &exp_date, InvitationState::CREATED, &None);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.post(format!("/v1/invitations/{}/reject", inv_id));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        r#"{"result":{"engineeringError":null,"message":"You are using an invitation that you've created.\nArmore is designed for you to share your location with the people you love.\nTo achieve this, you must send the invitation (link) to the person you want to follow you.\nIf you have any questions, go to the profile section and ask us anything by email or discord."},"success":false}"#,
        &response.body_string().unwrap()
    );
}

#[test]
fn test_access_to_invalid_invitation() {
    dbmate_rebuild();
    insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
    let token = create_token("coche", "coche_iphone").unwrap();

    let inv_id = "RandomId";

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.post(format!("/v1/invitations/{}/reject", inv_id));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        r#"{"result":{"engineeringError":null,"message":"There is no invitation with that id"},"success":false}"#,
        &response.body_string().unwrap()
    );
}

#[test]
fn test_accept_invitation() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
    let token = create_token("coche", "coche_iphone").unwrap();

    let exp_date = (Local::now() + week()).to_rfc3339();
    let inv_id = "XjKlQptXcAeQ";
    insert_mock_invitation_link("dario", inv_id, &exp_date, InvitationState::CREATED, &None);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.post(format!("/v1/invitations/{}/accept", inv_id));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        r#"{"success":true,"result":{"message":"Ok","username":"dario","publicKey":"MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA6lORI0goLg5HUlkcnnAO\nplNP9RF6QfHQ3EyS8aBEkxYVtQhvrG+cIN0X5ws48wqsCm3/fCQtwPghuDuCXRG8\nrJTxWr5eUOy49HATRMHIdWSSG8sdz2SH//5lDu9u6u6QtUflYPEmNXCwZAzhhaWs\nDhqYkBIbNKcCnspzI/itw7znaKdfSNQvXYWuT7LvDQAjorP+JJfy8JCQzHweT52F\nBU/By9KOl6XyeOqwPc4gcKBj72KWSczwqhM0fxAFaKc/xSRxMYbKCPPGXq1TqS1l\nxHLNHqMBvewxoM6eYHFvO5jekbLbdObh+irwwx1HlG24lYwGTc/7bDBkqMWTrvg+\nVE4oCweIRi93pW21MLxUIZeH7G4gmPutwgY6gaZEYoKY9gvlupGU5TDZvF5Ny69F\nrs3OJF4m9Lp7IQKdOCvnXnug6XB67vSc3a13kDygkTTfBVT8gdkb0yGkyhGwG2VA\n9TGyxGgYFSVHHFW6vPl65b0ksLiED5twulJ4kzb4trEaayrqvYMgoNnq967RuOcp\nnNQ885Uit5HTfNaU8/aRWnkDy/ItZCwzkABkP0GNLAKLKZ6hrtu5gHeVqi1xTvXx\npai+Emj+NmxkhpPsWFqCQznnLQ/BNBhQn/EtMU03W3Q6nA0QO1o37w8b/689dWwV\ncMTE2BCIg/sAjsqQ8I9zEskCAwEAAQ=="}}"#,
        &response.body_string().unwrap()
    );
}

#[test]
fn test_accept_own_invitation() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    let token = create_token("dario", "dario_iphone").unwrap();

    let exp_date = (Local::now() + week()).to_rfc3339();
    let inv_id = "XjKlQptXcAeQ";
    insert_mock_invitation_link("dario", inv_id, &exp_date, InvitationState::CREATED, &None);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.post(format!("/v1/invitations/{}/accept", inv_id));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        r#"{"result":{"engineeringError":null,"message":"You are using an invitation that you've created.\nArmore is designed for you to share your location with the people you love.\nTo achieve this, you must send the invitation (link) to the person you want to follow you.\nIf you have any questions, go to the profile section and ask us anything by email or discord."},"success":false}"#,
        &response.body_string().unwrap()
    );
}

#[test]
fn test_accept_accepted_invitation() {
    dbmate_rebuild();
    insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
    let token = create_token("coche", "coche_iphone").unwrap();

    let exp_date = (Local::now() + week()).to_rfc3339();
    let inv_id = "XjKlQptXcAeQ";
    insert_mock_invitation_link(
        "dario",
        inv_id,
        &exp_date,
        InvitationState::ACCEPTED,
        &Some("billburr".to_string()),
    );

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.post(format!("/v1/invitations/{}/accept", inv_id));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        r#"{"result":{"engineeringError":null,"message":"The invitation is no longer valid"},"success":false}"#,
        &response.body_string().unwrap()
    );
}

#[test]
fn test_accept_already_friends() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
    let token = create_token("coche", "coche_iphone").unwrap();

    let exp_date = (Local::now() + week()).to_rfc3339();
    let inv_id = "XjKlQptXcAeQ";
    insert_mock_invitation_link("dario", inv_id, &exp_date, InvitationState::CREATED, &None);

    insert_mock_friends("dario", "coche");

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.post(format!("/v1/invitations/{}/accept", inv_id));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        &response.body_string().unwrap(),
        r#"{"result":{"engineeringError":null,"message":"You are already friends with this user"},"success":false}"#
    );
}

#[test]
fn test_remove_friend() {
    dbmate_rebuild();
    insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
    let token = create_token("coche", "coche_iphone").unwrap();

    let exp_date = (Local::now() + week()).to_rfc3339();
    let inv_id = "XjKlQptXcAeQ";
    insert_mock_invitation_link(
        "dario",
        inv_id,
        &format!("{}", exp_date),
        InvitationState::CREATED,
        &None,
    );

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.get(format!("/v1/invitations/{}/creator", inv_id));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        r#"{"success":true,"result":{"firstName":"Dario","lastName":"Lencina-Talarico"}}"#,
        &response.body_string().unwrap()
    );
}

#[test]
fn test_remove_non_existing_friend() {
    dbmate_rebuild();
    insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
    let token = create_token("coche", "coche_iphone").unwrap();

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.delete("/v1/invitations/remove/dario");
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        r#"{"result":{"engineeringError":null,"message":"You are not friends with this user"},"success":false}"#,
        &response.body_string().unwrap()
    );
}

#[test]
fn test_get_inv_creator() {
    dbmate_rebuild();
    insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
    let token = create_token("coche", "coche_iphone").unwrap();

    let exp_date = (Local::now() + week()).to_rfc3339();
    let inv_id = "XjKlQptXcAeQ";
    insert_mock_invitation_link(
        "dario",
        inv_id,
        &format!("{}", exp_date),
        InvitationState::CREATED,
        &None,
    );

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.get(format!("/v1/invitations/{}/creator", inv_id));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        r#"{"success":true,"result":{"firstName":"Dario","lastName":"Lencina-Talarico"}}"#,
        &response.body_string().unwrap()
    );
}

#[test]
fn test_get_non_existent_inv() {
    dbmate_rebuild();
    insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
    let token = create_token("coche", "coche_iphone").unwrap();

    let inv_id = "AodWEfA";
    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.get(format!("/v1/invitations/{}/creator", inv_id));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        r#"{"result":{"engineeringError":null,"message":"There is no invitation with that id"},"success":false}"#,
        &response.body_string().unwrap()
    );
}
