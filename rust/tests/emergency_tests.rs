use amiquip::{Connection, QueueDeleteOptions};
use lib::constants::ASIMOV_LIVES;
use lib::server::emergency::rocket;
use lib::{
    controllers::emergency::{get_emergency_connections, update_user_state},
    model::emergency::UserState,
    messaging::get_rabbitmq_uri,
};
use lib::{db::get_pool, messaging::send_notification};
use rocket::http::Header;
use rocket::http::Status;
use rocket::local::Client;
use rocket_contrib::json;

mod common;

use common::{
    auth::{create_token, MOCK_PUBLIC_KEY},
    db::{insert_mock_friends, insert_mock_public_key},
    rabbit::{bind_notifications_queue, consume_message},
    dbmate::dbmate_rebuild
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
    queue.delete(QueueDeleteOptions::default()).unwrap();
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
    assert_eq!(String::from_utf8_lossy(&message), "[{\"data\":{\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! Please CONFIRM that they are okay!!\",\"title\":\"RescueLink SOS\"},\"deviceId\":\"b526979c-cade-4198-8fa4-fb077ef7544g\"},{\"dynamicTemplateData\":{\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! Please CONFIRM that they are okay!!\",\"link\":\"Go to app\",\"linkTitle\":\"https://armore.dev\",\"picture\":\"https://storage.cloud.google.com/rescuelink_user_pictures/predator.png\",\"title\":\"RescueLink SOS\"},\"email\":\"darioalessandro.l.encina@gmail.com\",\"templateId\":\"d-f4c36d6358cd445e9a873e103c3efe05\",\"username\":\"billburr\"},{\"data\":{\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! Please CONFIRM that they are okay!!\",\"title\":\"RescueLink SOS\"},\"deviceId\":\"coche_iphone\"},{\"dynamicTemplateData\":{\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! Please CONFIRM that they are okay!!\",\"link\":\"Go to app\",\"linkTitle\":\"https://armore.dev\",\"picture\":\"https://storage.cloud.google.com/rescuelink_user_pictures/predator.png\",\"title\":\"RescueLink SOS\"},\"email\":\"luiscoche9@gmail.com\",\"templateId\":\"d-f4c36d6358cd445e9a873e103c3efe05\",\"username\":\"coche\"},{\"data\":{\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! Please CONFIRM that they are okay!!\",\"title\":\"RescueLink SOS\"},\"deviceId\":\"b526979c-cade-4198-8fa4-fb077ef7544f\"},{\"dynamicTemplateData\":{\"body\":\"Dario Lencina-Talarico is in an EMERGENCY! Please CONFIRM that they are okay!!\",\"link\":\"Go to app\",\"linkTitle\":\"https://armore.dev\",\"picture\":\"https://storage.cloud.google.com/rescuelink_user_pictures/predator.png\",\"title\":\"RescueLink SOS\"},\"email\":\"darioalessandro.lencina@gmail.com\",\"templateId\":\"d-f4c36d6358cd445e9a873e103c3efe05\",\"username\":\"louisck\"}]");
    queue.delete(QueueDeleteOptions::default()).unwrap();
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
    update_user_state(&mut conn, &String::from("dario"), UserState::Emergency).unwrap();

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
    update_user_state(&mut conn, &String::from("dario"), UserState::Emergency).unwrap();

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
    assert_eq!(String::from_utf8_lossy(&message), "[{\"data\":{\"body\":\"Dario Lencina-Talarico is no longer in an emergency.\",\"title\":\"RescueLink SOS\"},\"deviceId\":\"b526979c-cade-4198-8fa4-fb077ef7544g\"},{\"dynamicTemplateData\":{\"body\":\"Dario Lencina-Talarico is no longer in an emergency.\",\"link\":\"Go to app\",\"linkTitle\":\"https://armore.dev\",\"picture\":\"https://storage.cloud.google.com/rescuelink_user_pictures/predator.png\",\"title\":\"RescueLink SOS\"},\"email\":\"darioalessandro.l.encina@gmail.com\",\"templateId\":\"d-f4c36d6358cd445e9a873e103c3efe05\",\"username\":\"billburr\"},{\"data\":{\"body\":\"Dario Lencina-Talarico is no longer in an emergency.\",\"title\":\"RescueLink SOS\"},\"deviceId\":\"b526979c-cade-4198-8fa4-fb077ef7544f\"},{\"dynamicTemplateData\":{\"body\":\"Dario Lencina-Talarico is no longer in an emergency.\",\"link\":\"Go to app\",\"linkTitle\":\"https://armore.dev\",\"picture\":\"https://storage.cloud.google.com/rescuelink_user_pictures/predator.png\",\"title\":\"RescueLink SOS\"},\"email\":\"darioalessandro.lencina@gmail.com\",\"templateId\":\"d-f4c36d6358cd445e9a873e103c3efe05\",\"username\":\"louisck\"}]");
    queue.delete(QueueDeleteOptions::default()).unwrap();
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
fn test_users_state_changes_stored_correctly() {
    dbmate_rebuild();
    let username = String::from("dario");
    insert_mock_public_key(&username, MOCK_PUBLIC_KEY);

    let pool = get_pool();
    let mut conn = pool.get().unwrap();
    update_user_state(&mut conn, &username, UserState::Emergency).unwrap();
    update_user_state(&mut conn, &username, UserState::Normal).unwrap();

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
