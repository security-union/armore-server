use amiquip::Connection as RabbitConnection;
use lib::{
    db::get_pool,
    messaging::{
        build_user_push_notifications, create_force_refresh_json, get_rabbitmq_uri,
        send_force_refresh,
    },
    model::{devices::OS, notifications::NotificationData},
};

mod common;
use common::dbmate::dbmate_rebuild;

#[macro_use]
extern crate rocket_contrib;

#[test]
fn test_build_android_notification() {
    let mut notification_string = create_force_refresh_json(
        &"123".to_string(),
        &OS::Android,
        &"1234".to_string(),
        &"dario".to_string(),
    );
    notification_string.retain(|c| !c.is_whitespace());
    assert_eq!(
        notification_string,
        "{\"deviceId\":\"123\",\"data\":{\"priority\":\"high\",\"custom\":{\"data\":\
    {\"command\":\"RefreshTelemetry\",\"correlationId\":\"1234\",\
    \"username\":\"dario\",\"aps\":{\"content-available\":1}}}}}"
    );
}

#[test]
fn test_build_ios_notification() {
    let mut notification_string = create_force_refresh_json(
        &"123".to_string(),
        &OS::iOS,
        &"1234".to_string(),
        &"dario".to_string(),
    );
    notification_string.retain(|c| !c.is_whitespace());
    assert_eq!(
        notification_string,
        "{\"deviceId\":\"123\",\"data\":{\"contentAvailable\":true,\
    \"silent\":true,\"payload\":{\"command\":\"RefreshTelemetry\",\
    \"correlationId\":\"1234\",\"username\":\"dario\"}}}"
    );
}

#[test]
fn test_force_refresh() {
    dbmate_rebuild();
    let db_client = get_pool();
    let mut client = db_client.get().unwrap();
    let mut rabbitmq = RabbitConnection::insecure_open(&get_rabbitmq_uri())
        .ok()
        .unwrap();

    let result = send_force_refresh(
        &mut client,
        &mut rabbitmq,
        &"dario".to_string(),
        &"dario".to_string(),
        &"123".to_string(),
    );
    assert_eq!(result.is_ok(), true);
}

#[test]
fn format_user_notifications_test() {
    dbmate_rebuild();
    let db_client = get_pool();
    let mut client = db_client.get().unwrap();

    let result = build_user_push_notifications(
        &NotificationData {
            username: "dario".to_string(),
            title: "hola!".to_string(),
            body: "adios!".to_string(),
        },
        &mut client,
        None,
    );

    let result = json!(result).to_string();

    assert_eq!(
        result,
        "[{\"data\":{\"body\":\"adios!\",\"title\":\"hola!\"},\"deviceId\":\"dario_iphone\"}]"
    );
}

#[test]
fn format_user_notifications_with_priority_test() {
    dbmate_rebuild();
    let db_client = get_pool();
    let mut client = db_client.get().unwrap();

    let result = build_user_push_notifications(
        &NotificationData {
            username: "dario".to_string(),
            title: "hola!".to_string(),
            body: "adios!".to_string(),
        },
        &mut client,
        Some("high"),
    );

    let result = json!(result).to_string();

    assert_eq!(
        result,
        "[{\"data\":{\"body\":\"adios!\",\"priority\":\"high\",\"title\":\"hola!\"},\"deviceId\":\"dario_iphone\"}]"
    );
}
