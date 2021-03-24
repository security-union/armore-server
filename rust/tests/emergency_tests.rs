#[macro_use]
extern crate pretty_assertions;

use amiquip::Connection;
use lib::constants::ASIMOV_LIVES;
use lib::server::emergency::rocket;
use lib::{
    constants::DATE_FORMAT,
    controllers::emergency::{get_emergency_connections, update_state},
    messaging::get_rabbitmq_uri,
    model::emergency::UserState,
};
use lib::{db::get_pool, messaging::send_notification};
use rocket::http::Header;
use rocket::http::Status;
use rocket::local::Client;
use rocket_contrib::json;

mod common;

use common::{
    auth::{create_token, MOCK_PUBLIC_KEY},
    db::{insert_mock_friends, insert_mock_public_key, insert_mock_telemetry},
    dbmate::dbmate_rebuild,
    rabbit::{bind_notifications_queue, consume_message},
};

#[test]
fn test_get_emergency_connections() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    insert_mock_friends("dario", "coche");
    let pool = get_pool();
    let mut client = pool.get().unwrap();
    let recipients = get_emergency_connections(&mut client, &"dario".to_string()).unwrap();
    assert_eq!("[{\"email\":\"darioalessandro.l.encina@gmail.com\",\"username\":\"billburr\"},{\"email\":\"luiscoche9@gmail.com\",\"username\":\"coche\"},{\"email\":\"darioalessandro.lencina@gmail.com\",\"username\":\"louisck\"}]", json!(recipients).to_string());
}

#[test]
fn test_send_notifications() {
    let mut rabbit = Connection::insecure_open(&get_rabbitmq_uri()).unwrap();
    let channel = rabbit.open_channel(None).unwrap();
    let queue = bind_notifications_queue(&channel);
    send_notification(&channel, String::from("Hello, World")).unwrap();
    let message = consume_message(&queue);
    assert_eq!("Hello, World", String::from_utf8_lossy(&message));
}

#[test]
fn test_report_emergency() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    insert_mock_friends("dario", "coche");

    let mut rabbit = Connection::insecure_open(&get_rabbitmq_uri()).unwrap();
    let channel = rabbit.open_channel(None).unwrap();
    let queue = bind_notifications_queue(&channel);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();
    let mut request = client.post("/v1/emergency/state");
    request.add_header(Header::new("Content-Type", "application/json"));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    request.set_body(r#"{"new_state":"Emergency"}"#);
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        &response.body_string().unwrap(),
        r#"{"success":true,"result":{"message":"Emergency"}}"#
    );

    let message = consume_message(&queue);
    assert_eq!(String::from_utf8_lossy(&message), "[{\"data\":{\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! \
    Please CONFIRM that they are okay!\",\"icon\":\"ic_stat_logo\",\"priority\":\"high\",\"title\":\"Armore SOS\"},\
    \"deviceId\":\"b526979c-cade-4198-8fa4-fb077ef7544g\"},{\"dynamicTemplateData\":{\"body\":\"Dario Lencina-Talarico is \
    in an EMERGENCY! Please CONFIRM that they are okay!\",\"link\":\"https://armore.dev\",\"linkTitle\":\"Go to app\",\
    \"picture\":\"https://storage.cloud.google.com/rescuelink_user_pictures/predator.png\",\"title\":\"Armore SOS\"},\
    \"email\":\"darioalessandro.l.encina@gmail.com\",\"templateId\":\"d-f4c36d6358cd445e9a873e103c3efe05\",\
    \"username\":\"billburr\"},{\"data\":{\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! Please CONFIRM that they \
    are okay!\",\"icon\":\"ic_stat_logo\",\"priority\":\"high\",\"title\":\"Armore SOS\"},\"deviceId\":\"coche_iphone\"},{\"dynamicTemplateData\":\
    {\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! Please CONFIRM that they are okay!\",\"link\":\"https://armore.dev\"\
    ,\"linkTitle\":\"Go to app\",\"picture\":\"https://storage.cloud.google.com/rescuelink_user_pictures/predator.png\",\
    \"title\":\"Armore SOS\"},\"email\":\"luiscoche9@gmail.com\",\"templateId\":\"d-f4c36d6358cd445e9a873e103c3efe05\",\
    \"username\":\"coche\"},{\"data\":{\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! Please CONFIRM that they are okay!\"\
    ,\"icon\":\"ic_stat_logo\",\"priority\":\"high\",\"title\":\"Armore SOS\"},\"deviceId\":\"b526979c-cade-4198-8fa4-fb077ef7544f\"},{\"dynamicTemplateData\"\
    :{\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! Please CONFIRM that they are okay!\",\"link\":\"https://armore.dev\",\
    \"linkTitle\":\"Go to app\",\"picture\":\"https://storage.cloud.google.com/rescuelink_user_pictures/predator.png\",\"title\":\
    \"Armore SOS\"},\"email\":\"darioalessandro.lencina@gmail.com\",\"templateId\":\"d-f4c36d6358cd445e9a873e103c3efe05\",\"username\
    \":\"louisck\"}]");
}

#[test]
fn test_report_emergency_with_null_email_user() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    insert_mock_friends("dario", "coche");

    let pool = get_pool();
    let mut client = pool.get().unwrap();
    client
        .query(
            "UPDATE users SET email=NULL, phone_number=72698427 WHERE username=$1",
            &[&"coche".to_string()],
        )
        .unwrap();

    let mut rabbit = Connection::insecure_open(&get_rabbitmq_uri()).unwrap();
    let channel = rabbit.open_channel(None).unwrap();
    let queue = bind_notifications_queue(&channel);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();
    let mut request = client.post("/v1/emergency/state");
    request.add_header(Header::new("Content-Type", "application/json"));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    request.set_body(r#"{"new_state":"Emergency"}"#);
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        &response.body_string().unwrap(),
        r#"{"success":true,"result":{"message":"Emergency"}}"#
    );

    let message = consume_message(&queue);
    assert_eq!(String::from_utf8_lossy(&message), "[{\"data\":{\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! Please \
     CONFIRM that they are okay!\",\"icon\":\"ic_stat_logo\",\"priority\":\"high\",\"title\":\"Armore SOS\"},\"deviceId\":\"b526979c-cade-4198-8fa4-f\
     b077ef7544g\"},{\"dynamicTemplateData\":{\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! Please CONFIRM that they \
      are okay!\",\"link\":\"https://armore.dev\",\"linkTitle\":\"Go to app\",\"picture\":\"https://storage.cloud.google.com\
      /rescuelink_user_pictures/predator.png\",\"title\":\"Armore SOS\"},\"email\":\"darioalessandro.l.encina@gmail.com\",\"te\
      mplateId\":\"d-f4c36d6358cd445e9a873e103c3efe05\",\"username\":\"billburr\"},{\"data\":{\"body\":\"Dario Lencina-Talarico \
       is in an EMERGENCY! Please CONFIRM that they are okay!\",\"icon\":\"ic_stat_logo\",\"priority\":\"high\",\"title\":\"Armore SOS\"},\"deviceId\":\
       \"coche_iphone\"},{\"data\":{\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! Please CONFIRM that they are okay!\",\
       \"icon\":\"ic_stat_logo\",\"priority\":\"high\",\"title\":\"Armore SOS\"},\"deviceId\":\"b526979c-cade-4198-8fa4-fb077ef7544f\"},{\"dynamicTempla\
       teData\":{\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! Please CONFIRM that they are okay!\",\"link\":\
       \"https://armore.dev\",\"linkTitle\":\"Go to app\",\"picture\":\"https://storage.cloud.google.com/rescuelink_user_p\
       ictures/predator.png\",\"title\":\"Armore SOS\"},\"email\":\"darioalessandro.lencina@gmail.com\",\"templateId\":\"d-f4\
       c36d6358cd445e9a873e103c3efe05\",\"username\":\"louisck\"}]");
}

#[test]
fn test_report_emergency_on_emergency_state() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();
    let pool = get_pool();
    let mut conn = pool.get().unwrap();
    update_state(&mut conn, &String::from("dario"), &UserState::Emergency).unwrap();

    let mut request = client.post("/v1/emergency/state");
    request.add_header(Header::new("Content-Type", "application/json"));
    request.add_header(Header::new(ASIMOV_LIVES, token));
    request.set_body(r#"{"new_state":"Emergency"}"#);
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        &response.body_string().unwrap(),
        r#"{"result":{"engineeringError":null,"message":"Cannot report the emergency"},"success":false}"#
    );
}

#[test]
fn test_update_to_normal() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);

    let mut rabbit = Connection::insecure_open(&get_rabbitmq_uri()).unwrap();
    let channel = rabbit.open_channel(None).unwrap();
    let queue = bind_notifications_queue(&channel);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();

    let pool = get_pool();
    let mut conn = pool.get().unwrap();
    update_state(&mut conn, &String::from("dario"), &UserState::Emergency).unwrap();

    let mut request = client.post("/v1/emergency/state");
    request.add_header(Header::new("Content-Type", "application/json"));
    request.add_header(Header::new(ASIMOV_LIVES, token.clone()));
    request.set_body(r#"{"new_state":"Normal"}"#);
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        &response.body_string().unwrap(),
        r#"{"success":true,"result":{"message":"Normal"}}"#
    );

    let message = consume_message(&queue);
    assert_eq!(String::from_utf8_lossy(&message), "[{\"data\":{\"body\":\"Dario Lencina-Talarico is no longer in an emergency.\",\"icon\":\"ic_stat_logo\",\"priority\":\"high\",\"title\":\"Armore SOS\"},\"deviceId\":\"b526979c-cade-4198-8fa4-fb077ef7544g\"},{\"dynamicTemplateData\":{\"body\":\"Dario Lencina-Talarico is no longer in an emergency.\",\"link\":\"https://armore.dev\",\"linkTitle\":\"Go to app\",\"picture\":\"https://storage.cloud.google.com/rescuelink_user_pictures/predator.png\",\"title\":\"Armore SOS\"},\"email\":\"darioalessandro.l.encina@gmail.com\",\"templateId\":\"d-f4c36d6358cd445e9a873e103c3efe05\",\"username\":\"billburr\"},{\"data\":{\"body\":\"Dario Lencina-Talarico is no longer in an emergency.\",\"icon\":\"ic_stat_logo\",\"priority\":\"high\",\"title\":\"Armore SOS\"},\"deviceId\":\"b526979c-cade-4198-8fa4-fb077ef7544f\"},{\"dynamicTemplateData\":{\"body\":\"Dario Lencina-Talarico is no longer in an emergency.\",\"link\":\"https://armore.dev\",\"linkTitle\":\"Go to app\",\"picture\":\"https://storage.cloud.google.com/rescuelink_user_pictures/predator.png\",\"title\":\"Armore SOS\"},\"email\":\"darioalessandro.lencina@gmail.com\",\"templateId\":\"d-f4c36d6358cd445e9a873e103c3efe05\",\"username\":\"louisck\"}]");
}

#[test]
fn test_update_to_normal_on_normal_state() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();

    let mut request = client.post("/v1/emergency/state");
    request.add_header(Header::new("Content-Type", "application/json"));
    request.add_header(Header::new(ASIMOV_LIVES, token.clone()));
    request.set_body(r#"{"new_state":"Normal"}"#);
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        &response.body_string().unwrap(),
        r#"{"result":{"engineeringError":null,"message":"Cannot end the emergency"},"success":false}"#
    );
}

#[test]
fn test_cant_report_emergency_for_a_friend_in_emergency() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    insert_mock_friends("dario", "coche");

    let pool = get_pool();
    let mut conn = pool.get().unwrap();
    update_state(&mut conn, &String::from("coche"), &UserState::Emergency).unwrap();

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();
    let mut request = client.post("/v1/emergency/coche/report");
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        &response.body_string().unwrap(),
        r#"{"result":{"engineeringError":null,"message":"Cannot report the emergency"},"success":false}"#
    );
}
#[test]
fn test_can_report_emergency_for_a_friend_not_in_emergency() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    insert_mock_friends("dario", "coche");

    let mut rabbit = Connection::insecure_open(&get_rabbitmq_uri()).unwrap();
    let channel = rabbit.open_channel(None).unwrap();
    let queue = bind_notifications_queue(&channel);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();
    let mut request = client.post("/v1/emergency/coche/report");
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        &response.body_string().unwrap(),
        r#"{"success":true,"result":{"message":"Emergency"}}"#
    );

    let message = consume_message(&queue);
    assert_eq!(String::from_utf8_lossy(&message), "[{\"data\":{\"body\":\"Coche Rodríguez is in an EMERGENCY! Please CONFIRM that \
    they are okay!\",\"icon\":\"ic_stat_logo\",\"priority\":\"high\",\"title\":\"Armore SOS\"},\"deviceId\":\"dario_iphone\"},{\"dynamicTemplateData\":\
    {\"body\":\"Coche Rodríguez is in an EMERGENCY! Please CONFIRM that they are okay!\",\"link\":\"https://armore.dev\",\"linkTitle\"\
    :\"Go to app\",\"picture\":\"https://storage.cloud.google.com/rescuelink_user_pictures/predator.png\",\"title\":\"Armore SOS\"}\
    ,\"email\":\"darioalessandrolencina@gmail.com\",\"templateId\":\"d-f4c36d6358cd445e9a873e103c3efe05\",\"username\":\"dario\"}]");
}

#[test]
fn test_cant_report_emergency_for_a_non_friend() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();
    let mut request = client.post("/v1/emergency/non_friend/report");
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        &response.body_string().unwrap(),
        r#"{"result":{"engineeringError":null,"message":"You are not friends with this user"},"success":false}"#
    );
}

#[test]
fn test_users_state_changes_stored_correctly() {
    dbmate_rebuild();
    let username = String::from("dario");
    insert_mock_public_key(&username, MOCK_PUBLIC_KEY);

    let pool = get_pool();
    let mut conn = pool.get().unwrap();
    update_state(&mut conn, &username, &UserState::Emergency).unwrap();
    update_state(&mut conn, &username, &UserState::Normal).unwrap();

    conn.query(
        "SELECT * FROM users_state_history 
            WHERE username = $1
            ORDER BY creation_timestamp",
        &[&username],
    )
    .and_then(|rows| {
        assert_eq!(2, rows.len());

        let first = &rows[0];
        let state: UserState = first.get("self_perception");
        assert_eq!(UserState::Emergency, state);

        let last = &rows[1];
        let state: UserState = last.get("self_perception");
        assert_eq!(UserState::Normal, state);
        Ok(())
    })
    .unwrap();
}

#[test]
fn test_cant_get_historical_location_from_invalid_datetime_range() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();

    let end_time = chrono::Utc::now();
    let start_time = end_time - chrono::Duration::days(3);

    let endpoint = format!(
        "/v1/emergency/{}/telemetry?start_time={}&end_time={}",
        "non_friend",
        end_time.format(DATE_FORMAT),
        start_time.format(DATE_FORMAT)
    );

    let mut request = client.get(endpoint);
    request.add_header(Header::new("Content-Type", "application/json"));
    request.add_header(Header::new(ASIMOV_LIVES, token.clone()));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        &response.body_string().unwrap(),
        r#"{"result":{"engineeringError":null,"message":"Invalid date range"},"success":false}"#
    );
}

#[test]
fn test_cant_get_historical_location_from_more_than_one_week_ago() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();

    let end_time = chrono::Utc::now();
    let start_time = end_time - chrono::Duration::weeks(2);

    let endpoint = format!(
        "/v1/emergency/{}/telemetry?start_time={}&end_time={}",
        "non_friend",
        start_time.format(DATE_FORMAT),
        end_time.format(DATE_FORMAT)
    );

    let mut request = client.get(endpoint);
    request.add_header(Header::new("Content-Type", "application/json"));
    request.add_header(Header::new(ASIMOV_LIVES, token.clone()));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        &response.body_string().unwrap(),
        r#"{"result":{"engineeringError":null,"message":"It is not possible to obtain the location from more than a week ago."},"success":false}"#
    );
}

#[test]
fn test_cant_get_historical_location_for_a_non_friend() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();

    let end_time = chrono::Utc::now();
    let start_time = end_time - chrono::Duration::days(3);

    let endpoint = format!(
        "/v1/emergency/{}/telemetry?start_time={}&end_time={}",
        "non_friend",
        start_time.format(DATE_FORMAT),
        end_time.format(DATE_FORMAT)
    );

    let mut request = client.get(endpoint);
    request.add_header(Header::new("Content-Type", "application/json"));
    request.add_header(Header::new(ASIMOV_LIVES, token.clone()));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        &response.body_string().unwrap(),
        r#"{"result":{"engineeringError":null,"message":"You are not friends with this user"},"success":false}"#
    );
}

#[test]
fn test_cant_get_historical_location_for_a_friend_that_is_not_in_emergency() {
    dbmate_rebuild();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    insert_mock_friends("dario", "coche");

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();

    let end_time = chrono::Utc::now();
    let start_time = end_time - chrono::Duration::days(3);

    let endpoint = format!(
        "/v1/emergency/{}/telemetry?start_time={}&end_time={}",
        "coche",
        start_time.format(DATE_FORMAT),
        end_time.format(DATE_FORMAT)
    );

    let mut request = client.get(endpoint);
    request.add_header(Header::new("Content-Type", "application/json"));
    request.add_header(Header::new(ASIMOV_LIVES, token.clone()));
    let mut response = request.dispatch();

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        &response.body_string().unwrap(),
        r#"{"result":{"engineeringError":null,"message":"This user is not in an emergency"},"success":false}"#
    );
}

#[test]
fn test_get_historical_location_for_a_friend_in_emergency() {
    dbmate_rebuild();

    let pool = get_pool();
    let mut conn = pool.get().unwrap();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    insert_mock_friends("dario", "coche");
    update_state(&mut conn, &String::from("coche"), &UserState::Emergency).unwrap();

    let yesterday = chrono::Utc::now().naive_utc() - chrono::Duration::days(1);

    insert_mock_telemetry("coche", "coche_iphone", "dario", yesterday);
    insert_mock_telemetry("coche", "coche_iphone", "dario", yesterday);
    insert_mock_telemetry("coche", "coche_iphone", "dario", yesterday);

    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let token = create_token("dario", "dario_iphone").unwrap();

    let end_time = chrono::Utc::now();
    let start_time = end_time - chrono::Duration::days(3);

    let endpoint = format!(
        "/v1/emergency/{}/telemetry?start_time={}&end_time={}",
        "coche",
        start_time.format(DATE_FORMAT),
        end_time.format(DATE_FORMAT)
    );

    let mut request = client.get(endpoint);
    request.add_header(Header::new("Content-Type", "application/json"));
    request.add_header(Header::new(ASIMOV_LIVES, token.clone()));
    let mut response = request.dispatch();

    let expected = format!(
        r#"{{"success":true,"result":[{{"data":"encryptedData","device_id":"coche_iphone","timestamp":"{0}"}},{{"data":"encryptedData","device_id":"coche_iphone","timestamp":"{0}"}},{{"data":"encryptedData","device_id":"coche_iphone","timestamp":"{0}"}}]}}"#,
        yesterday.format(DATE_FORMAT)
    );

    assert_eq!(response.status(), Status::Ok);
    assert_eq!(&response.body_string().unwrap(), &expected);
}
