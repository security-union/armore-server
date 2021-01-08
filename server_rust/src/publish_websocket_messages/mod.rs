/*
 * *
 *  * Copyright [2018] [Dario Alessandro Lencina Talarico]
 *  * Licensed under the Apache License, Version 2.0 (the "License");
 *  * y ou may not use this file except in compliance with the License.
 *  * You may obtain a copy of the License at
 *  * http://www.apache.org/licenses/LICENSE-2.0
 *  * Unless required by applicable law or agreed to in writing, software
 *  * distributed under the License is distributed on an "AS IS" BASIS,
 *  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  * See the License for the specific language governing permissions and
 *  * limitations under the License.
 *
 *
 */
use std::env;

use amiquip::{Connection, ExchangeDeclareOptions, ExchangeType, Publish, Result as RabbitResult};
use chrono::Utc;
use postgres::{NoTls, Statement};
use r2d2::PooledConnection;
use r2d2_postgres::PostgresConnectionManager;

use crate::model::{TelemetryUpdate, TelemetryWebsocketUpdate, DATE_FORMAT, OS};

static WEBSOCKET_EXCHANGE: &str = "websocket.exchange";
static NOTIFICATIONS_EXCHANGE: &str = "notifications.exchange";
static NOTIFICATIONS_ROUTING_KEY: &str = "notifications";

pub fn get_rabbitmq_uri() -> String {
    let rabbitmq_user = env::var("RABBITMQ_USER").expect("RABBITMQ_USER must be set");
    let rabbitmq_pass = env::var("RABBITMQ_PASS").expect("RABBITMQ_PASS must be set");
    let rabbitmq_host = env::var("RABBITMQ_HOST").expect("RABBITMQ_HOST must be set");
    let rabbitmq_vhost = env::var("RABBITMQ_VHOST").expect("RABBITMQ_VHOST must be set");

    format!(
        "amqp://{}:{}@{}/{}",
        rabbitmq_user, rabbitmq_pass, rabbitmq_host, rabbitmq_vhost
    )
}

pub fn send_ws_message(
    connection: &mut Connection,
    telemetry: &TelemetryUpdate,
    username: &String,
) -> RabbitResult<()> {
    let channel = connection.open_channel(None)?;

    let exchange = channel.exchange_declare(
        ExchangeType::Topic,
        WEBSOCKET_EXCHANGE,
        ExchangeDeclareOptions {
            durable: false,
            auto_delete: false,
            internal: false,
            arguments: Default::default(),
        },
    )?;

    debug!("Publishing to exchange {}", exchange.name());
    let topic = format!("location.{}.*", telemetry.recipientUsername);

    let telemetry_update = json!(TelemetryWebsocketUpdate {
        data: telemetry.data.to_string(),
        recipientUsername: telemetry.recipientUsername.to_string(),
        timestamp: Utc::now().format(DATE_FORMAT.as_ref()).to_string(),
        username: username.to_string()
    });
    let message = telemetry_update.to_string();

    exchange.publish(Publish::new(message.as_bytes(), topic))
}

pub fn send_broadcast_notification(
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
    connection: &mut Connection,
    usernames: &Vec<String>,
    title: &str,
    body: &str,
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
    let message: String = format_user_notifications(usernames, client, title, body);
    exchange.publish(Publish::new(message.as_bytes(), NOTIFICATIONS_ROUTING_KEY))
}

fn format_user_notifications(
    usernames: &Vec<String>,
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
    title: &str,
    body: &str,
) -> String {
    let message = usernames
        .iter()
        .flat_map(|username| {
            get_subscriber_device_ids(client, username).map_or(vec![], |data| {
                data.into_iter()
                    .map(|(device_id, _os)| {
                        format!(
                            r#"{{
                            "deviceId": "{}",
                            "data": {{
                                "title": "{}",
                                "body": "{}"
                            }}
                        }}"#,
                            &device_id, &title, &body
                        )
                    })
                    .collect::<Vec<String>>()
            })
        })
        .fold_first(|acc, curr| format!("{},{}", acc, curr))
        .map_or("{}".to_string(), |data| data);
    format!("[{}]", message)
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

pub fn send_force_refresh(
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
    connection: &mut Connection,
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

pub fn get_subscriber_device_ids(
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
    username: &String,
) -> Option<Vec<(String, OS)>> {
    let statement: Option<Statement> = client
        .prepare(
            "SELECT users_devices.device_id, devices.os \
            FROM users_devices JOIN devices \
            ON users_devices.device_id = devices.device_id \
            WHERE users_devices.username=$1 AND users_devices.owner = true",
        )
        .ok();

    let query = statement
        .map(|statement| client.query(&statement, &[&username]).ok())
        .flatten();

    query.map(|rows| {
        rows.into_iter()
            .map(|row| {
                let device_id: String = row.get("device_id");
                let os: OS = row.get("os");
                (device_id, os)
            })
            .collect()
    })
}

#[cfg(test)]
mod test {
    use super::format_user_notifications;
    use crate::db::get_pool;
    use crate::model::OS;
    use crate::{
        dbmate,
        publish_websocket_messages::{
            create_force_refresh_json, get_rabbitmq_uri, send_force_refresh,
        },
    };
    use amiquip::Connection as RabbitConnection;
    use dbmate::dbmate_rebuild;
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

        let result = format_user_notifications(
            &vec!["dario".to_string(), "coche".to_string()],
            &mut client,
            "hola!",
            "adios!",
        );

        assert_eq!(result, "[{\n                            \"deviceId\": \"dario_iphone\",\n                            \"data\": {\n                                \"title\": \"hola!\",\n                                \"body\": \"adios!\"\n                            }\n                        },{\n                            \"deviceId\": \"coche_iphone\",\n                            \"data\": {\n                                \"title\": \"hola!\",\n                                \"body\": \"adios!\"\n                            }\n                        }]");
    }
}
