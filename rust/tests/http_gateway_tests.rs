use regex::Regex;
use rocket::http::Header;
use rocket::http::Status;
use rocket::local::Client;
use serde_json::{json, Value};

use lib::auth::ASIMOV_LIVES;
use lib::model::{
    APIResponse, AccessType, BatteryState, ChargingState, Connection, Telemetry, TelemetryResponse,
    UserDetails, UserState,
};

mod common;
use common::{
    auth::{create_token, MOCK_PUBLIC_KEY, MOCK_PUBLIC_KEY_2},
    db::insert_mock_public_key,
    dbmate::dbmate_rebuild,
    redis::flush_redis,
};
use lib::http_gateway::handlers::rocket;

#[test]
fn test_get_follower_keys() {
    dbmate_rebuild();
    flush_redis();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    let token = create_token("dario", "dario_iphone").unwrap();
    let rocket = rocket();

    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.get("/v1/followers/keys");
    request.add_header(Header::new(ASIMOV_LIVES, token));
    let mut response = request.dispatch();
    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        response.body_string(),
        Some(r#"{"success":true,"result":[]}"#.to_string())
    )
}

#[test]
fn test_get_follower_keys_no_api() {
    dbmate_rebuild();
    flush_redis();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let request = client.get("/v1/followers/keys");
    let mut response = request.dispatch();
    assert_eq!(response.status(), Status::Forbidden);
    assert_eq!(response.body_string(), Some("{\"success\":false,\"result\":{\"message\":\"Unauthorized\",\"engineeringError\":\"The JWT Token is not good\"}}".to_string()))
}

#[test]
fn test_post_telemetry() {
    dbmate_rebuild();
    flush_redis();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    let token = create_token("dario", "dario_iphone").unwrap();
    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.post("/v1/telemetry");
    request.add_header(Header::new(ASIMOV_LIVES, token));
    request.add_header(Header::new("Content-type", "application/json"));
    request.set_body(
        r#"{
        "returnFriendLocations": false,
        "telemetry": []
    }"#,
    );
    let mut response = request.dispatch();
    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        response.body_string(),
        Some(r#"{"success":true,"result":null}"#.to_string())
    )
}

#[test]
fn test_post_telemetry_with_data() {
    // Remove timestamps like a boss
    let timestamp_regex = Regex::new(",\"timestamp\":\"[^\"]*\"").unwrap();
    dbmate_rebuild();
    flush_redis();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    insert_mock_public_key("billburr", MOCK_PUBLIC_KEY);
    let token = create_token("dario", "dario_iphone").unwrap();
    let token_bill = create_token("billburr", "dario_iphone").unwrap();
    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request_bill = client.post("/v1/telemetry");
    request_bill.add_header(Header::new(ASIMOV_LIVES, token_bill));
    request_bill.add_header(Header::new("Content-type", "application/json"));
    request_bill.set_body(
        r#"{
        "returnFriendLocations": true,
        "telemetry": [
            {
                "data": "bla bla",
                "recipientUsername": "dario"
            }
        ]
    }"#,
    );
    let response_bill = request_bill.dispatch();
    assert_eq!(response_bill.status(), Status::Ok);

    let mut request = client.post("/v1/telemetry");
    request.add_header(Header::new(ASIMOV_LIVES, token));
    request.add_header(Header::new("Content-type", "application/json"));
    request.set_body(
        r#"{
        "returnFriendLocations": true,
        "telemetry": []
    }"#,
    );
    let mut response = request.dispatch();
    assert_eq!(response.status(), Status::Ok);
    let left: Value = serde_json::from_str(
        timestamp_regex
            .replace_all(response.body_string().unwrap().as_str(), "")
            .as_ref(),
    )
    .unwrap();

    let right: Value = json!(APIResponse {
            success: true,
            result: TelemetryResponse {
                following: [
                    ("billburr".to_string(), Connection {
                        userDetails: UserDetails {
                            username: "billburr".to_string(),
                            firstName: "Bill".to_string(),
                            lastName: "Burr".to_string(),
                            email: Some("darioalessandro.l.encina@gmail.com".to_string()),
                            phoneNumber: None,
                            picture: Some("predator.png".to_string()),
                            language: None,
                        },
                        accessType: Some(AccessType::Permanent),
                        telemetry: Some(Telemetry {
                            batteryState: None,
                            data:"bla bla".to_string(),
                            timestamp:"2020-01-01T00:49:58.000Z".to_string()
                        }),
                        state: Some(UserState::Normal),
                        publicKey: None,
                    }),
                    ("louisck".to_string(), Connection {
                        userDetails: UserDetails {
                            username: "louisck".to_string(),
                            firstName: "Louis".to_string(),
                            lastName: "CK".to_string(),
                            email: Some("darioalessandro.lencina@gmail.com".to_string()),
                            phoneNumber: None,
                            picture: Some("predator.png".to_string()),
                            language: None,
                        },
                        accessType: Some(AccessType::Permanent),
                        telemetry: None,
                        state: Some(UserState::Normal),
                        publicKey: None,
                    })
                ].iter().cloned().collect(),
                followers: [
                    ("billburr".to_string(), Connection {
                        userDetails: UserDetails {
                            username: "billburr".to_string(),
                            firstName: "Bill".to_string(),
                            lastName: "Burr".to_string(),
                            email: Some("darioalessandro.l.encina@gmail.com".to_string()),
                            phoneNumber: None,
                            picture: Some("predator.png".to_string()),
                            language: None,
                        },
                        accessType: Some(AccessType::Permanent),
                        telemetry: None,
                        state: None,
                        publicKey: Some("MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA6lORI0goLg5HUlkcnnAO\nplNP9RF6QfHQ3EyS8aBEkxYVtQhvrG+cIN0X5ws48wqsCm3/fCQtwPghuDuCXRG8\nrJTxWr5eUOy49HATRMHIdWSSG8sdz2SH//5lDu9u6u6QtUflYPEmNXCwZAzhhaWs\nDhqYkBIbNKcCnspzI/itw7znaKdfSNQvXYWuT7LvDQAjorP+JJfy8JCQzHweT52F\nBU/By9KOl6XyeOqwPc4gcKBj72KWSczwqhM0fxAFaKc/xSRxMYbKCPPGXq1TqS1l\nxHLNHqMBvewxoM6eYHFvO5jekbLbdObh+irwwx1HlG24lYwGTc/7bDBkqMWTrvg+\nVE4oCweIRi93pW21MLxUIZeH7G4gmPutwgY6gaZEYoKY9gvlupGU5TDZvF5Ny69F\nrs3OJF4m9Lp7IQKdOCvnXnug6XB67vSc3a13kDygkTTfBVT8gdkb0yGkyhGwG2VA\n9TGyxGgYFSVHHFW6vPl65b0ksLiED5twulJ4kzb4trEaayrqvYMgoNnq967RuOcp\nnNQ885Uit5HTfNaU8/aRWnkDy/ItZCwzkABkP0GNLAKLKZ6hrtu5gHeVqi1xTvXx\npai+Emj+NmxkhpPsWFqCQznnLQ/BNBhQn/EtMU03W3Q6nA0QO1o37w8b/689dWwV\ncMTE2BCIg/sAjsqQ8I9zEskCAwEAAQ==".to_string()),
                    }),
                    ("louisck".to_string(), Connection {
                        userDetails: UserDetails {
                            username: "louisck".to_string(),
                            firstName: "Louis".to_string(),
                            lastName: "CK".to_string(),
                            email: Some("darioalessandro.lencina@gmail.com".to_string()),
                            phoneNumber: None,
                            picture: Some("predator.png".to_string()),
                            language: None,
                        },
                        accessType: Some(AccessType::Permanent),
                        telemetry: None,
                        state: None,
                        publicKey: None
                    })

                ].iter().cloned().collect()
            }
    });

    let right: Value =
        serde_json::from_str(timestamp_regex.replace_all(&right.to_string(), "").as_ref()).unwrap();

    assert_eq!(left, right)
}

#[test]
fn test_post_telemetry_with_battery_data() {
    // Remove timestamps like a boss
    let timestamp_regex = Regex::new(",\"timestamp\":\"[^\"]*\"").unwrap();
    dbmate_rebuild();
    flush_redis();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    insert_mock_public_key("billburr", MOCK_PUBLIC_KEY);
    let token = create_token("dario", "dario_iphone").unwrap();
    let token_bill = create_token("billburr", "dario_iphone").unwrap();
    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request_bill = client.post("/v1/telemetry");
    request_bill.add_header(Header::new(ASIMOV_LIVES, token_bill));
    request_bill.add_header(Header::new("Content-type", "application/json"));
    request_bill.set_body(
        r#"{
        "returnFriendLocations": true,
        "telemetry": [
            {
                "data": "bla bla",
                "recipientUsername": "dario"
            }
        ],
        "batteryState": {
            "batteryLevel":34.2,
            "chargingState":"ChargingAc",
            "isCharging": true
        }
    }"#,
    );
    let response_bill = request_bill.dispatch();
    assert_eq!(response_bill.status(), Status::Ok);

    let mut request = client.post("/v1/telemetry");
    request.add_header(Header::new(ASIMOV_LIVES, token));
    request.add_header(Header::new("Content-type", "application/json"));
    request.set_body(
        r#"{
        "returnFriendLocations": true,
        "telemetry": []
    }"#,
    );
    let mut response = request.dispatch();
    assert_eq!(response.status(), Status::Ok);
    let left: Value = serde_json::from_str(
        timestamp_regex
            .replace_all(response.body_string().unwrap().as_str(), "")
            .as_ref(),
    )
    .unwrap();

    let right: Value = json!(APIResponse {
            success: true,
            result: TelemetryResponse {
                following: [
                    ("billburr".to_string(), Connection {
                        userDetails: UserDetails {
                            username: "billburr".to_string(),
                            firstName: "Bill".to_string(),
                            lastName: "Burr".to_string(),
                            email: Some("darioalessandro.l.encina@gmail.com".to_string()),
                            phoneNumber: None,
                            picture: Some("predator.png".to_string()),
                            language: None,
                        },
                        accessType: Some(AccessType::Permanent),
                        telemetry: Some(Telemetry {
                            batteryState: Some(BatteryState {
                                batteryLevel: Some(34.2),
                                chargingState: Some(ChargingState::ChargingAc),
                                isCharging: Some(true)
                            }),
                            data:"bla bla".to_string(),
                            timestamp:"2020-01-01T00:49:58.000Z".to_string()
                        }),
                        state: Some(UserState::Normal),
                        publicKey: None,
                    }),
                    ("louisck".to_string(), Connection {
                        userDetails: UserDetails {
                            username: "louisck".to_string(),
                            firstName: "Louis".to_string(),
                            lastName: "CK".to_string(),
                            email: Some("darioalessandro.lencina@gmail.com".to_string()),
                            phoneNumber: None,
                            picture: Some("predator.png".to_string()),
                            language: None,
                        },
                        accessType: Some(AccessType::Permanent),
                        telemetry: None,
                        state: Some(UserState::Normal),
                        publicKey: None,
                    })
                ].iter().cloned().collect(),
                followers: [
                    ("billburr".to_string(), Connection {
                        userDetails: UserDetails {
                            username: "billburr".to_string(),
                            firstName: "Bill".to_string(),
                            lastName: "Burr".to_string(),
                            email: Some("darioalessandro.l.encina@gmail.com".to_string()),
                            phoneNumber: None,
                            picture: Some("predator.png".to_string()),
                            language: None,
                        },
                        accessType: Some(AccessType::Permanent),
                        telemetry: None,
                        state: None,
                        publicKey: Some("MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA6lORI0goLg5HUlkcnnAO\nplNP9RF6QfHQ3EyS8aBEkxYVtQhvrG+cIN0X5ws48wqsCm3/fCQtwPghuDuCXRG8\nrJTxWr5eUOy49HATRMHIdWSSG8sdz2SH//5lDu9u6u6QtUflYPEmNXCwZAzhhaWs\nDhqYkBIbNKcCnspzI/itw7znaKdfSNQvXYWuT7LvDQAjorP+JJfy8JCQzHweT52F\nBU/By9KOl6XyeOqwPc4gcKBj72KWSczwqhM0fxAFaKc/xSRxMYbKCPPGXq1TqS1l\nxHLNHqMBvewxoM6eYHFvO5jekbLbdObh+irwwx1HlG24lYwGTc/7bDBkqMWTrvg+\nVE4oCweIRi93pW21MLxUIZeH7G4gmPutwgY6gaZEYoKY9gvlupGU5TDZvF5Ny69F\nrs3OJF4m9Lp7IQKdOCvnXnug6XB67vSc3a13kDygkTTfBVT8gdkb0yGkyhGwG2VA\n9TGyxGgYFSVHHFW6vPl65b0ksLiED5twulJ4kzb4trEaayrqvYMgoNnq967RuOcp\nnNQ885Uit5HTfNaU8/aRWnkDy/ItZCwzkABkP0GNLAKLKZ6hrtu5gHeVqi1xTvXx\npai+Emj+NmxkhpPsWFqCQznnLQ/BNBhQn/EtMU03W3Q6nA0QO1o37w8b/689dWwV\ncMTE2BCIg/sAjsqQ8I9zEskCAwEAAQ==".to_string()),
                    }),
                    ("louisck".to_string(), Connection {
                        userDetails: UserDetails {
                            username: "louisck".to_string(),
                            firstName: "Louis".to_string(),
                            lastName: "CK".to_string(),
                            email: Some("darioalessandro.lencina@gmail.com".to_string()),
                            phoneNumber: None,
                            picture: Some("predator.png".to_string()),
                            language: None,
                        },
                        accessType: Some(AccessType::Permanent),
                        telemetry: None,
                        state: None,
                        publicKey: None
                    })

                ].iter().cloned().collect()
            }
    });

    let right: Value =
        serde_json::from_str(timestamp_regex.replace_all(&right.to_string(), "").as_ref()).unwrap();

    assert_eq!(left, right)
}

#[test]
fn test_post_telemetry_with_invalid_correlation_id() {
    dbmate_rebuild();
    flush_redis();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    insert_mock_public_key("billburr", MOCK_PUBLIC_KEY);
    let token_bill = create_token("billburr", "dario_iphone").unwrap();
    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request_bill = client.post("/v1/telemetry");
    request_bill.add_header(Header::new(ASIMOV_LIVES, token_bill));
    request_bill.add_header(Header::new("Content-type", "application/json"));
    request_bill.set_body(
        r#"{
        "returnFriendLocations": true,
        "telemetry": [
            {
                "data": "bla bla",
                "recipientUsername": "dario"
            }
        ],
        "batteryState": {
            "batteryLevel":34.2,
            "chargingState":"ChargingAc",
            "isCharging": true
        },
        "correlationId": "123"
    }"#,
    );
    let response_bill = request_bill.dispatch();
    assert_eq!(response_bill.status(), Status::Ok);
}

#[test]
fn test_post_telemetry_invalid_recipients() {
    dbmate_rebuild();
    flush_redis();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    let token = create_token("dario", "dario_iphone").unwrap();
    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request = client.post("/v1/telemetry");
    request.add_header(Header::new(ASIMOV_LIVES, token));
    request.add_header(Header::new("Content-type", "application/json"));
    request.set_body(
        r#"{
        "returnFriendLocations": false,
        "telemetry": [
            {
                "recipientUsername": "sdfasdf",
                "data": "sdfsdf"
            }
        ]
    }"#,
    );
    let mut response = request.dispatch();
    assert_eq!(response.status(), Status::Ok);
    assert_eq!(
        response.body_string(),
        Some(String::from("{\"success\":true,\"result\":null}"))
    );
}

#[test]
fn test_post_device_settings() {
    dbmate_rebuild();
    flush_redis();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    insert_mock_public_key("billburr", MOCK_PUBLIC_KEY);
    let token_dario = create_token("dario", "dario_iphone").unwrap();
    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request_dario = client.post("/v1/device/settings");
    request_dario.add_header(Header::new(ASIMOV_LIVES, token_dario));
    request_dario.add_header(Header::new("Content-type", "application/json"));
    request_dario.set_body(
        r#"{
            "locationPermissionState": "ALWAYS",
            "isPowerSaveModeOn": false,
            "isNotificationsEnabled": false,
            "isBackgroundRefreshOn": true,
            "isLocationServicesOn": true,
            "osVersion": "14.0",
            "appVersion": "2.5 build 8"
        }"#,
    );
    let response_dario = request_dario.dispatch();
    assert_eq!(response_dario.status(), Status::Ok);
}

#[test]
fn test_post_device_settings_fails_if_not_owner() {
    dbmate_rebuild();
    flush_redis();
    insert_mock_public_key("dario", MOCK_PUBLIC_KEY);
    insert_mock_public_key("billburr", MOCK_PUBLIC_KEY_2);
    let spoofed_token = create_token("billburr", "dario_iphone").unwrap();
    let rocket = rocket();
    let client = Client::new(rocket).expect("valid rocket instance");
    let mut request_dario = client.post("/v1/device/settings");
    request_dario.add_header(Header::new(ASIMOV_LIVES, spoofed_token));
    request_dario.add_header(Header::new("Content-type", "application/json"));
    request_dario.set_body(
        r#"{
            "locationPermissionState": "ALWAYS",
            "isPowerSaveModeOn": false,
            "isNotificationsEnabled": false,
            "isBackgroundRefreshOn": true,
            "isLocationServicesOn": true,
            "osVersion": "14.0",
            "appVersion": "2.5 build 8"
        }"#,
    );
    let response_dario = request_dario.dispatch();
    assert_eq!(response_dario.status(), Status::Forbidden);
}
