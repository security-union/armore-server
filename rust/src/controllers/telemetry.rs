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
use crate::constants::{DATE_FORMAT, NANNY_RETRY_HASH_MAP, TELEMETRY_LAST_SEEN_SET};
use crate::constants::{NOTIFICATIONS_EXCHANGE, NOTIFICATIONS_ROUTING_KEY};
use crate::controllers::devices::get_subscriber_device_ids;
use crate::lang::TranslationIds;
use crate::messaging::get_rabbitmq_uri;
use crate::model::{
    auth::AuthInfo,
    devices::OS,
    devices::{AppState::UNKNOWN, BatteryState, ChargingState},
    emergency::{AccessType, UserState},
    requests::TelemetryRequest,
    responses::{CommandResponse, Errors::APIInternalError, TelemetryResponse},
    telemetry::{Command, CommandState, Connection, FollowerKey, Telemetry},
    UserDetails,
};
use amiquip::{
    Connection as RabbitConnection, ExchangeDeclareOptions, ExchangeType, Publish,
    Result as RabbitResult,
};
use chrono::{Local, Utc};
use postgres::error::Error;
use postgres::{NoTls, Row};
use r2d2::{Pool, PooledConnection};
use r2d2_postgres::PostgresConnectionManager;
use redis::Commands;
use rocket_contrib::json::Json;
use std::collections::HashMap;
use uuid::Uuid;

pub fn get_public_key(
    username: &String,
    pool: &Pool<PostgresConnectionManager<NoTls>>,
) -> Result<String, APIInternalError> {
    let mut client = pool.get().expect("Failed to get client from pool.");
    let statement = client
        .prepare(
            "
         SELECT public_key
         from users_identity where username = $1
     ",
        )
        .map_err(APIInternalError::from_db_err)?;
    let rows = client.query(&statement, &[&username]);
    return match rows.unwrap().first() {
        Option::Some(row) => Ok(row.get("public_key")),
        _ => Err(APIInternalError {
            msg: TranslationIds::NoUserForKey,
            engineering_error: None,
        }),
    };
}

pub fn redis_hash_map_name(username: &str) -> String {
    return format!("telemetry.{username}", username = username);
}

pub fn store_telemetry(
    telemetry_request: &Json<TelemetryRequest>,
    auth_info: &AuthInfo,
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
    redis: &mut redis::Connection,
) -> Result<String, APIInternalError> {
    for telemetry in &telemetry_request.telemetry {
        let statement = client
             .prepare(
                 "insert into device_telemetry
         (username, device_id, recipient_username, encrypted_location, creation_timestamp, app_state,
         charging_state, battery_level, is_charging)
          values ($1, $2, $3, $4, now(), $5, $6, $7, $8)",
             )
             .map_err(APIInternalError::from_db_err)?;

        let battery_state = telemetry_request
            .batteryState
            .as_ref()
            .unwrap_or(&BatteryState {
                batteryLevel: Option::Some(0.0),
                chargingState: Option::Some(ChargingState::UNKNOWN),
                isCharging: Option::Some(false),
            });
        let _rows = client
            .query(
                &statement,
                &[
                    &auth_info.username,
                    &auth_info.deviceId,
                    &telemetry.recipientUsername,
                    &telemetry.data,
                    &telemetry_request.appState.unwrap_or(UNKNOWN),
                    &battery_state.chargingState.unwrap(),
                    &battery_state.batteryLevel.unwrap(),
                    &battery_state.isCharging.unwrap(),
                ],
            )
            .map_err(APIInternalError::from_db_err)?;
        let hash_map_name = redis_hash_map_name(&telemetry.recipientUsername);
        let utc_time = Utc::now();
        let local_now = Local::now();
        let telemetry = json!(Telemetry {
            data: telemetry.data.clone(),
            timestamp: utc_time.format(DATE_FORMAT.as_ref()).to_string(),
            batteryState: telemetry_request.batteryState.clone()
        });
        let telemetry_string = serde_json::to_string(&telemetry).unwrap();
        redis
            .hset(hash_map_name, &auth_info.username, &telemetry_string)
            .map_err(APIInternalError::from_db_err)?;
        redis
            .zadd(
                &TELEMETRY_LAST_SEEN_SET.to_string(),
                &auth_info.username,
                local_now.timestamp(),
            )
            .map_err(APIInternalError::from_db_err)?;
        redis
            .hdel(&NANNY_RETRY_HASH_MAP.to_string(), &auth_info.username)
            .map_err(APIInternalError::from_db_err)?;
    }
    Ok("Ok".to_string())
}

pub fn get_follower_keys(
    username: &str,
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
) -> Result<Vec<FollowerKey>, APIInternalError> {
    let statement = client
        .prepare(
            "SELECT username_follower as \"username\", public_key FROM users_followers
     INNER JOIN users_identity
     ON users_identity.username = users_followers.username_follower
     WHERE users_followers.username = $1
     ",
        )
        .map_err(APIInternalError::from_db_err)?;
    let result = client
        .query(&statement, &[&username])
        .map_err(APIInternalError::from_db_err)?;
    let followers_keys = result
        .iter()
        .map(|row| {
            let username: String = row.get("username");
            let key: String = row.get("public_key");
            FollowerKey { username, key }
        })
        .collect();
    Ok(followers_keys)
}

pub fn get_user_state(
    username: &str,
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
) -> Result<Option<UserState>, APIInternalError> {
    let statement = client
        .prepare("SELECT self_perception FROM users_state WHERE username = $1")
        .map_err(APIInternalError::from_db_err)?;
    let user_state: Option<UserState> = client
        .query(&statement, &[&username])
        .map_err(APIInternalError::from_db_err)?
        .iter()
        .fold(None, |_acc, row| {
            let user_state: Option<UserState> = row.get("self_perception");
            user_state
        });
    Ok(user_state)
}

pub fn get_user_details(
    username: &str,
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
) -> Result<Option<UserDetails>, Error> {
    let statement = client.prepare(
         "SELECT users.email, users.phone_number, user_details.username, user_details.first_name, user_details.last_name, user_details.picture, user_details.language 
                 FROM users 
                 INNER JOIN user_details 
                 ON users.username = user_details.username AND users.username = $1")?;
    let user_details: Option<UserDetails> = client
        .query(&statement, &[&username])?
        .iter()
        .fold(None, |_acc, row| {
            Option::Some(UserDetails::from_complete_details(row))
        });
    return Ok(user_details);
}

pub fn get_followers(
    username: &str,
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
) -> Result<HashMap<String, Connection>, APIInternalError> {
    let followers = client
        .query(
            "SELECT * FROM users_followers \
             INNER JOIN users
             ON users.username = users_followers.username_follower
             INNER JOIN user_details
             ON user_details.username = users_followers.username_follower
             LEFT JOIN users_identity ON users_identity.username = users_followers.username_follower
             WHERE users_followers.username = $1
             ",
            &[&username],
        )
        .map_err(APIInternalError::from_db_err)?;

    let followers_map = followers
        .iter()
        .map(|row| {
            let username: String = row.get("username_follower");
            let access_type: Option<AccessType> = row.get("access_type");
            let public_key: Option<String> = row.get("public_key");
            (
                username.clone(),
                Connection {
                    userDetails: UserDetails {
                        username,
                        firstName: row.get("first_name"),
                        lastName: row.get("last_name"),
                        email: row.get("email"),
                        phoneNumber: row.get("phone_number"),
                        picture: row.get("picture"),
                        language: Option::None,
                    },
                    accessType: access_type,
                    telemetry: Option::None,
                    state: Option::None,
                    publicKey: public_key,
                },
            )
        })
        .collect();

    return Ok(followers_map);
}

#[allow(non_snake_case)]
pub fn get_connections(
    username: &str,
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
    redis: &mut redis::Connection,
) -> Result<TelemetryResponse, APIInternalError> {
    let rows: HashMap<String, Connection> = get_followers(&username, client)?;

    Ok(TelemetryResponse {
        followers: rows,
        following: getFollowingLastLocation(username, client, redis)
            .map_err(APIInternalError::from_db_err)?,
    })
}

#[allow(non_snake_case)]
pub fn getFollowingLastLocation(
    follower: &str,
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
    redis: &mut redis::Connection,
) -> Result<HashMap<String, Connection>, Error> {
    let statement = client.prepare(
        r#"
     SELECT users_followers.username,
        users_followers.username_follower,
        users_followers.access_type,
        user_details.first_name,
        user_details.last_name,
        user_details.picture,
        users.email,
        users.phone_number,
        users_state.self_perception
     FROM users_followers
     INNER JOIN user_details ON user_details.username = users_followers.username
     INNER JOIN users ON users.username = users_followers.username
     INNER JOIN users_state ON users_state.username = users_followers.username
     WHERE username_follower = $1;
     "#,
    )?;

    let queryResult = client.query(&statement, &[&follower])?;
    let mut deviceLocations: HashMap<String, Vec<&Row>> = HashMap::new();
    for row in queryResult.iter() {
        let username: String = row.get("username");
        match deviceLocations.get(&username) {
            Option::None => {
                let mut vec: Vec<&Row> = Vec::new();
                vec.push(row);
                deviceLocations.insert(username.clone(), vec);
            }
            Option::Some(matchedRow) => {
                let mut vec = matchedRow.to_vec();
                vec.push(row);
                deviceLocations.insert(username.clone(), vec);
            }
        }
    }

    Ok(deviceLocations
        .iter()
        .map(|tuple| {
            let username = tuple.0;
            let rows = tuple.1;
            let head_row = rows.first().unwrap();
            let userDetails = UserDetails {
                username: username.clone(),
                firstName: head_row.get("first_name"),
                lastName: head_row.get("last_name"),
                email: head_row.get("email"),
                phoneNumber: head_row.get("phone_number"),
                picture: head_row.get("picture"),
                language: Option::None,
            };

            let accessType: Option<AccessType> = head_row.get("access_type");
            let state: Option<UserState> = head_row.get("self_perception");

            // Get telemetry
            let telemetry = match (accessType.clone(), state.clone()) {
                (Some(AccessType::EmergencyOnly), Some(UserState::Normal)) => None,
                _ => {
                    let w = get_last_user_location(redis, &username, &follower.to_string());
                    w
                }
            };

            (
                username.clone(),
                Connection {
                    userDetails,
                    accessType,
                    telemetry,
                    state,
                    publicKey: None,
                },
            )
        })
        .collect())
}

pub fn get_last_user_location(
    redis: &mut redis::Connection,
    username: &String,
    follower: &String,
) -> Option<Telemetry> {
    let telemetry_string: Option<String> = redis.hget(redis_hash_map_name(follower), username).ok();

    return telemetry_string
        .map(|unwrapped| serde_json::from_str(unwrapped.as_ref()).ok())
        .flatten();
}

pub fn create_command(
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
    username: &str,
    recipient_username: &str,
    command: &Command,
) -> Result<String, APIInternalError> {
    let correlation_id = Uuid::new_v4();

    let statement = client
        .prepare(
            "insert into commands
         (username, recipient_username, request_timestamp, correlation_id, type, state)
          values ($1, $2, now(), $3, $4, $5)",
        )
        .map_err(APIInternalError::from_db_err)?;

    let _rows = client
        .query(
            &statement,
            &[
                &username,
                &recipient_username,
                &correlation_id.to_string(),
                command,
                &CommandState::Created,
            ],
        )
        .map_err(APIInternalError::from_db_err)?;

    Ok(correlation_id.to_string())
}

pub fn close_command(
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
    command_state: &CommandState,
    correlation_id: &String,
) -> Result<(), Error> {
    let statement = client.prepare(
        "update commands SET
             response_timestamp = now(),
             state = $1
             WHERE correlation_id = $2",
    )?;
    let _rows = client.query(&statement, &[&command_state, &correlation_id])?;
    Ok(())
}

pub fn username_has_follower(
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
    username: &String,
    username_follower: &String,
) -> Result<bool, APIInternalError> {
    let statement = client
        .prepare(
            "select * from users_followers where
         username = $1 and username_follower = $2",
        )
        .map_err(APIInternalError::from_db_err)?;

    let rows = client
        .query(&statement, &[&username, &username_follower])
        .map_err(APIInternalError::from_db_err)?;
    Ok(!rows.is_empty())
}

pub fn sync_users_location(
    conn: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
    user1: String,
    user2: String,
) -> Result<(), APIInternalError> {
    let r1 = force_refresh_telemetry_internal(conn, user1.clone(), user2.clone())?;
    let r2 = force_refresh_telemetry_internal(conn, user2, user1)?;

    if r1.commandStatus == CommandState::Error || r2.commandStatus == CommandState::Error {
        error!("{}", r1.error.unwrap());
    }

    Ok(())
}

pub fn force_refresh_telemetry_internal(
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
    recipient_username: String,
    sender_username: String,
) -> Result<CommandResponse, APIInternalError> {
    // 1. Insert command into commands database.
    let correlation_id = create_command(
        client,
        &sender_username,
        &recipient_username,
        &Command::RefreshTelemetry,
    )?;

    // 3. Send push notification
    let send_result = RabbitConnection::insecure_open(&get_rabbitmq_uri())
        .ok()
        .map(|mut conn| {
            let _ = send_force_refresh(
                client,
                &mut conn,
                &sender_username,
                &recipient_username,
                &correlation_id,
            );
            return conn.close();
        });
    match send_result {
        Some(_) => Ok(CommandResponse {
            correlation_id: Option::Some(correlation_id),
            commandStatus: CommandState::Created,
            error: Option::None,
        }),
        None => {
            let res = close_command(client, &CommandState::Error, &correlation_id);
            if let Err(error) = res {
                error!("error closing the command {}", error)
            }
            Ok(CommandResponse {
                correlation_id: Option::Some(correlation_id),
                commandStatus: CommandState::Error,
                error: Option::Some("Failed to send the notification".to_string()),
            })
        }
    }
}

pub fn send_force_refresh(
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
    connection: &mut RabbitConnection,
    username: &String,
    username_recipient: &String,
    correlation_id: &String,
) -> RabbitResult<()> {
    let channel = connection.open_channel(None)?;

    let exchange = channel.exchange_declare(
        ExchangeType::Direct,
        NOTIFICATIONS_EXCHANGE,
        ExchangeDeclareOptions {
            durable: false,
            auto_delete: false,
            internal: false,
            arguments: Default::default(),
        },
    )?;

    debug!("Publishing to exchange {}", exchange.name());
    let notifications: Option<String> = get_subscriber_device_ids(client, username_recipient)
        .map(|devices| {
            return devices
                .into_iter()
                .map(|(device_id, os)| {
                    create_force_refresh_json(&device_id, &os, &correlation_id, &username)
                })
                .collect();
        })
        .map(|notifications: Vec<String>| notifications.join(","))
        .map(|notifications: String| vec!["[", notifications.as_str(), "]"].join(""));

    if notifications.is_some() {
        return exchange.publish(Publish::new(
            notifications.unwrap().as_bytes(),
            NOTIFICATIONS_ROUTING_KEY,
        ));
    }
    Ok(())
}

pub fn create_force_refresh_json(
    device_id: &String,
    os: &OS,
    correlation_id: &String,
    username: &String,
) -> String {
    match os {
        OS::Android => format!(
            r#"{{
               "deviceId": "{}",
               "data": {{
                 "priority": "high",
                 "custom": {{
                     "data": {{
                         "command": "RefreshTelemetry",
                         "correlationId": "{}",
                         "username": "{}",
                         "aps": {{
                           "content-available": 1
                         }}
                     }}
                 }}
               }}
            }}"#,
            &device_id, &correlation_id, &username
        ),
        _ => format!(
            r#"{{
               "deviceId": "{}",
               "data": {{
                 "contentAvailable": true,
                 "silent": true,
                 "payload": {{
                     "command": "RefreshTelemetry",
                     "correlationId": "{}",
                     "username": "{}"
                 }}
               }}
            }}"#,
            &device_id, &correlation_id, &username
        ),
    }
}
