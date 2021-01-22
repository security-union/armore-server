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

use amiquip::{
    Channel, Connection, ExchangeDeclareOptions, ExchangeType, Publish, Result as RabbitResult,
};
use chrono::Utc;
use postgres::NoTls;
use r2d2::PooledConnection;
use r2d2_postgres::PostgresConnectionManager;
use crate::db::devices::get_subscriber_device_ids;

use crate::model::{
    notifications::{NotificationData, PushNotification},
    telemetry::{TelemetryUpdate, TelemetryWebsocketUpdate},
    devices::OS,
};

use crate::constants::DATE_FORMAT;

static WEBSOCKET_EXCHANGE: &str = "websocket.exchange";
pub static NOTIFICATIONS_EXCHANGE: &str = "notifications.exchange";
pub static NOTIFICATIONS_ROUTING_KEY: &str = "notifications";

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

pub fn send_notification(channel: &Channel, value: String) -> RabbitResult<()> {
    let exchange = channel.exchange_declare(
        ExchangeType::Direct,
        NOTIFICATIONS_EXCHANGE,
        ExchangeDeclareOptions::default(),
    )?;
    debug!("Publishing to exchange {}", exchange.name());
    exchange.publish(Publish::new(value.as_bytes(), NOTIFICATIONS_ROUTING_KEY))
}

pub fn build_user_push_notifications(
    data: &NotificationData,
    client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
) -> Vec<PushNotification> {
    get_subscriber_device_ids(client, &data.username).map_or(vec![], |devices| {
        devices
            .into_iter()
            .map(|(device_id, _os)| PushNotification {
                deviceId: device_id,
                data: json!({
                    "title": &data.title,
                    "body": &data.body
                }),
            })
            .collect()
    })
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