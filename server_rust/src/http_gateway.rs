#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use]
extern crate log;
extern crate redis;
#[macro_use]
extern crate rocket;
/**
 * Copyright [2020] [Dario Alessandro Lencina Talarico]
 * Licensed under the Apache License, Version 2.0 (the "License");
 * y ou may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
extern crate rocket_contrib;

use std::env;

use amiquip::Connection;
use rocket::{Request, Rocket, State};
use rocket_contrib::json::Json;

use lib::db::devices_db::{get_device_by_id, update_device_settings};
use lib::db::get_pool;
use lib::db::telemetry_db::{
    close_command, force_refresh_telemetry_internal, get_connections, get_follower_keys,
    get_user_state, store_telemetry, username_has_follower,
};
use lib::model::{
    APIError, APIJsonResponse, APIResponse, AccessType, AuthInfo, CommandResponse, CommandState,
    DeviceUpdateRequest, DeviceUpdateResponse, FollowerKey, Storage, TelemetryRequest,
    TelemetryResponse, UserState,
};
use lib::publish_websocket_messages::{get_rabbitmq_uri, send_ws_message};

use lib::cors;

#[catch(403)]
fn forbidden(_req: &Request) -> Json<APIResponse<APIError>> {
    Json(APIResponse {
        success: false,
        result: APIError {
            message: "Unauthorized".to_string(),
            engineeringError: Some("The JWT Token is not good".to_string()),
        },
    })
}

#[catch(404)]
fn not_found(_req: &Request) -> Json<APIResponse<APIError>> {
    Json(APIResponse {
        success: false,
        result: APIError {
            message: "Unable to find endpoint".to_string(),
            engineeringError: Some("Unable to find endpoint".to_string()),
        },
    })
}

#[allow(unused_must_use)]
#[post(
    "/telemetry",
    format = "application/json",
    data = "<telemetry_request>"
)]
fn post_telemetry(
    state: State<Storage>,
    auth_info: AuthInfo,
    telemetry_request: Json<TelemetryRequest>,
) -> Result<Json<APIResponse<Option<TelemetryResponse>>>, APIJsonResponse> {
    let mut client = state
        .database
        .get()
        .expect("Unable to get database connection from state.");
    let mut redis = state
        .redis
        .clone()
        .expect("Unable to clone redis from state.")
        .get_connection()
        .expect("Unable to get redis connection from state.");

    store_telemetry(&telemetry_request, &auth_info, &mut client, &mut redis).map_err(|err| {
        APIJsonResponse::api_error_with_internal_error(err, auth_info.language.to_string())
    })?;

    // This request was force pushed due to a ForcePush Request, store the result.
    if telemetry_request.correlationId.is_some() {
        let error = close_command(
            &mut client,
            &CommandState::Completed,
            &telemetry_request.correlationId.as_ref().unwrap(),
        )
        .err();
        if error.is_some() {
            error!("error closing the command {}", error.unwrap())
        }
    }

    // TODO: send message to geofence service.
    let all_friends =
        get_connections(&auth_info.username, &mut client, &mut redis).map_err(|err| {
            APIJsonResponse::api_error_with_internal_error(err, auth_info.language.to_string())
        })?;

    let user_state = get_user_state(&auth_info.username, &mut client).map_err(|err| {
        APIJsonResponse::api_error_with_internal_error(err, auth_info.language.to_string())
    })?;

    match (user_state, Connection::insecure_open(&get_rabbitmq_uri())) {
        (Some(state), Ok(mut connection)) => {
            for telemetry in &telemetry_request.telemetry {
                let follower = all_friends.followers.get(&telemetry.recipientUsername);
                if follower.is_some() {
                    let access_type = follower.unwrap().accessType.unwrap();
                    if access_type == AccessType::Permanent || state == UserState::Emergency {
                        send_ws_message(&mut connection, telemetry, &auth_info.username);
                    }
                }
            }
            connection.close();
        }
        _ => {
            error!("Unable to send rabbitMqMessage");
        }
    }

    if telemetry_request.returnFriendLocations {
        Ok(Json(APIResponse {
            success: true,
            result: Option::Some(all_friends),
        }))
    } else {
        Ok(Json(APIResponse {
            success: true,
            result: Option::None,
        }))
    }
}

#[allow(unused_must_use)]
#[get("/followers/keys", format = "application/json")]
fn get_keys(
    state: State<Storage>,
    auth_info: AuthInfo,
) -> Result<Json<APIResponse<Vec<FollowerKey>>>, APIJsonResponse> {
    let mut client = state
        .database
        .get()
        .expect("Unable to get database connection from state.");
    let keys = get_follower_keys(&auth_info.username, &mut client)
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, auth_info.language))?;
    Ok(Json(APIResponse {
        success: true,
        result: keys,
    }))
}

#[allow(unused_must_use)]
#[get("/telemetry/<recipient_username>", format = "application/json")]
fn force_refresh_telemetry(
    recipient_username: String,
    state: State<Storage>,
    auth_info: AuthInfo,
) -> Result<Json<APIResponse<CommandResponse>>, APIJsonResponse> {
    let mut client = state
        .database
        .get()
        .expect("Unable to get database connection from state.");

    // 0. Verify that username follows recipient_username
    let username_has_follower =
        username_has_follower(&mut client, &recipient_username, &auth_info.username).map_err(
            |err| {
                APIJsonResponse::api_error_with_internal_error(err, auth_info.language.to_string())
            },
        )?;
    if !username_has_follower {
        return Ok(Json(APIResponse {
            success: false,
            result: CommandResponse {
                correlation_id: Option::None,
                commandStatus: CommandState::Error,
                error: Option::Some("security".to_string()),
            },
        }));
    }

    force_refresh_telemetry_internal(&mut client, recipient_username, &auth_info).map_err(|err| {
        APIJsonResponse::api_error_with_internal_error(err, auth_info.language.to_string())
    })
}

#[allow(unused_must_use)]
#[post(
    "/device/settings",
    data = "<device_update_request>",
    format = "application/json"
)]
fn update_device(
    device_update_request: Json<DeviceUpdateRequest>,
    state: State<Storage>,
    auth_info: AuthInfo,
) -> Result<Json<APIResponse<DeviceUpdateResponse>>, APIJsonResponse> {
    let mut client = state
        .database
        .get()
        .expect("Unable to get database connection from state.");

    let mut device_update =
        get_device_by_id(&auth_info.deviceId[..], &mut client).map_err(|error| {
            APIJsonResponse::api_error_with_internal_error(error, (&auth_info.language).to_string())
        })?;

    device_update.locationPermissionState = device_update_request.0.locationPermissionState;
    device_update.isBackgroundRefreshOn = device_update_request.0.isBackgroundRefreshOn;
    device_update.isLocationServicesOn = device_update_request.0.isLocationServicesOn;
    device_update.isNotificationsEnabled = device_update_request.0.isNotificationsEnabled;
    device_update.isPowerSaveModeOn = device_update_request.0.isPowerSaveModeOn;
    device_update.osVersion = device_update_request.0.osVersion.clone();
    device_update.appVersion = device_update_request.0.appVersion.clone();

    update_device_settings(device_update, &mut client)
        .and_then(|u| {
            Ok(Json(APIResponse {
                success: true,
                result: DeviceUpdateResponse { updated: u },
            }))
        })
        .map_err(|error| APIJsonResponse::api_error_with_internal_error(error, auth_info.language))
}

fn rocket() -> Rocket {
    let database = get_pool();
    let redis = redis::Client::open(env::var("REDIS_URL").expect("REDIS_URL must be set"))
        .expect("Failed to open redis client.");
    let storage = Storage {
        redis: Some(redis),
        database,
    };

    rocket::ignite()
        .mount(
            "/v1",
            routes![
                post_telemetry,
                get_keys,
                force_refresh_telemetry,
                update_device
            ],
        )
        .register(catchers![forbidden, not_found])
        .attach(cors::options())
        .manage(storage)
}

fn main() {
    env_logger::init();
    info!("Starting");
    rocket().launch();
}

#[cfg(test)]
mod test {
    use redis::Commands;
    use regex::Regex;
    use rocket::http::Header;
    use rocket::http::Status;
    use rocket::local::Client;
    use serde_json::{json, Value};
    use std::env;

    use lib::auth::{create_token, ASIMOV_LIVES, MOCK_PUBLIC_KEY, MOCK_PUBLIC_KEY_2};
    use lib::db::get_pool;
    use lib::db::telemetry_db::redis_hash_map_name;
    use lib::dbmate::dbmate_rebuild;
    use lib::model::{
        APIResponse, AccessType, BatteryState, ChargingState, Connection, Telemetry,
        TelemetryResponse, UserDetails, UserState,
    };

    use super::rocket;

    fn flush_redis() {
        let mut redis =
            redis::Client::open(env::var("REDIS_URL").expect("REDIS_URL must be set")).unwrap();
        redis
            .del::<String, ()>(redis_hash_map_name("dario"))
            .unwrap();
        redis
            .del::<String, ()>(redis_hash_map_name("louisck"))
            .unwrap();
        redis
            .del::<String, ()>(redis_hash_map_name("billburr"))
            .unwrap();
    }

    fn insert_mock_public_key(username: &str, public_key: &str) {
        let pool = get_pool();
        let mut client = pool.get().unwrap();
        let statement = client
            .prepare(
                "
        INSERT INTO users_identity (username, public_key, update_timestamp)
                VALUES ($1, $2, now())
                ON CONFLICT (username)
                    DO UPDATE
                    SET public_key = $2, update_timestamp = now()
        ",
            )
            .unwrap();
        let _rows = client.query(
            &statement,
            &[&username.to_string(), &public_key.to_string()],
        );
    }

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
            serde_json::from_str(timestamp_regex.replace_all(&right.to_string(), "").as_ref())
                .unwrap();

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
            serde_json::from_str(timestamp_regex.replace_all(&right.to_string(), "").as_ref())
                .unwrap();

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
        assert_eq!(response.body_string(),
                   Some("{\"result\":{\"engineeringError\":\"db error: ERROR: insert or update on table \\\"device_telemetry\\\" violates foreign key constraint \\\"device_telemetry_recipient_username_fkey\\\"\",\"message\":\"Database error, an engineer will be assigned to this issue\"},\"success\":false}".to_string()))
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
}
