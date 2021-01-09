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
use std::collections::HashMap;

use postgres::NoTls;
use postgres_types::{FromSql, ToSql};
use r2d2::Pool;
use r2d2::PooledConnection;
use r2d2_postgres::PostgresConnectionManager;
use rocket::http::{ContentType, Status};
use rocket::response::Responder;
use rocket::{response, Request, Response};
use rocket_contrib::json::Json;
use rocket_contrib::json::JsonValue;
use serde::{Deserialize, Serialize};

use crate::strings;
use chrono::{DateTime, Utc};

pub static DATE_FORMAT: &str = "%Y-%m-%dT%H:%M:%S.000Z";

pub type APIResult<T> = Result<Json<APIResponse<Option<T>>>, APIJsonResponse>;
pub type PostgresPool = Pool<PostgresConnectionManager<NoTls>>;
pub type PostgresConnection = PooledConnection<PostgresConnectionManager<NoTls>>;

#[derive(Debug, Clone)]
pub struct AcceptedNotificationData {
    pub creator: String,
    pub language: String,
    pub recipient: String
}

#[postgres(name = "link_invitation_state")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum InvitationState {
    CREATED,
    REJECTED,
    ACCEPTED,
    EXPIRED,
}

#[derive(Debug, Clone)]
pub struct LinkActionData {
    pub uuid: String,
    pub username: String,
}

#[derive(Debug, Clone)]
pub struct LinkCreationData {
    pub username: String,
    pub exp_date: DateTime<Utc>,
    pub uuid: String,
}

impl LinkCreationData {
    pub fn new(uuid: String, username: String, exp_date: String) -> Result<Self, APIJsonResponse> {
        if let Some(date_time) = Self::assert_exp_date(&exp_date) {
            Ok(Self {
                uuid,
                exp_date: date_time,
                username,
            })
        } else {
            return Err(APIJsonResponse::api_error(
                "Invalid creation timestamp".to_string(),
                None,
            ));
        }
    }

    fn assert_exp_date(exp_date: &str) -> Option<DateTime<Utc>> {
        let now = Utc::now();
        if let Ok(exp) = DateTime::parse_from_rfc3339(exp_date) {
            if exp >= now {
                return Some(exp.with_timezone(&Utc));
            }
        }
        return None;
    }
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InvitationReq {
    pub expirationDate: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InvitationResp {
    pub link: String,
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AuthInfo {
    pub key: String,
    pub username: String,
    pub deviceId: String,
    pub language: String,
}

#[allow(non_snake_case)]
#[allow(non_camel_case_types)]
#[postgres(name = "os")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum OS {
    Android,
    iOS,
    UNKNOWN,
}

#[postgres(name = "accesstype")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum AccessType {
    Permanent,
    EmergencyOnly,
}

#[postgres(name = "appstate")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum AppState {
    Background,
    Foreground,
    UNKNOWN,
}

#[postgres(name = "locationpermissionstate")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum LocationPermissionState {
    ALWAYS,
    USING,
    ASK,
    NEVER,
    UNKNOWN,
}

#[postgres(name = "userstate")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum UserState {
    Normal,
    Emergency,
}

#[postgres(name = "command")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum Command {
    RefreshTelemetry,
}

#[postgres(name = "commandstate")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum CommandState {
    Created,
    Completed,
    Error,
}

#[postgres(name = "chargingstate")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum ChargingState {
    ChargingUsb,
    ChargingAc,
    NotCharging,
    UNKNOWN,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Connection {
    pub userDetails: UserDetails,
    pub accessType: Option<AccessType>,
    pub telemetry: Option<Telemetry>,
    pub state: Option<UserState>,
    pub publicKey: Option<String>,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Device {
    pub deviceId: String,
    pub role: String,
    pub name: String,
    pub lastUpdatedTimestamp: Option<String>,
    pub locationPermissionState: LocationPermissionState,
    pub isNotificationsEnabled: Option<bool>,
    pub isBackgroundRefreshOn: Option<bool>,
    pub isLocationServicesOn: Option<bool>,
    pub isPowerSaveModeOn: Option<bool>,
    pub os: OS,
    pub osVersion: Option<String>,
    pub model: Option<String>,
    pub pushToken: Option<String>,
    pub appVersion: Option<String>,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserDetails {
    pub username: String,
    pub firstName: String,
    pub lastName: String,
    pub email: Option<String>,
    pub phoneNumber: Option<String>,
    pub picture: Option<String>,
    #[serde(skip_serializing)]
    pub language: Option<String>,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Telemetry {
    pub data: String,
    pub timestamp: String,
    pub batteryState: Option<BatteryState>,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TelemetryResponse {
    pub followers: HashMap<String, Connection>,
    pub following: HashMap<String, Connection>,
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone)]
pub struct FollowerKey {
    pub username: String,
    pub key: String,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct APIResponse<A> {
    pub success: bool,
    pub result: A,
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone)]
pub struct TelemetryUpdate {
    pub data: String,
    pub recipientUsername: String,
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone)]
pub struct TelemetryWebsocketUpdate {
    pub data: String,
    pub recipientUsername: String,
    pub timestamp: String,
    pub username: String,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatteryState {
    pub batteryLevel: Option<f64>,
    pub chargingState: Option<ChargingState>,
    pub isCharging: Option<bool>,
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone)]
pub struct TelemetryRequest {
    pub returnFriendLocations: bool,
    pub telemetry: Vec<TelemetryUpdate>,
    pub appState: Option<AppState>,
    pub batteryState: Option<BatteryState>,
    pub correlationId: Option<String>,
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DeviceUpdateRequest {
    pub locationPermissionState: LocationPermissionState,
    pub isNotificationsEnabled: Option<bool>,
    pub isBackgroundRefreshOn: Option<bool>,
    pub isLocationServicesOn: Option<bool>,
    pub isPowerSaveModeOn: Option<bool>,
    pub osVersion: Option<String>,
    pub appVersion: Option<String>,
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone)]
pub struct DeviceUpdateResponse {
    pub updated: bool,
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone)]
pub struct Message {
    pub message: String,
}

#[derive(Debug)]
#[allow(non_snake_case)]
pub struct APIJsonResponse {
    pub json: JsonValue,
    pub status: Status,
}

pub struct APIInternalError {
    pub msg: strings::TranslationIds,
    pub engineering_error: Option<String>,
}

impl APIJsonResponse {
    pub fn api_error_with_internal_error(
        internal_error: APIInternalError,
        lang: String,
    ) -> APIJsonResponse {
        let translated_error = strings::get_dictionary(lang).get(&internal_error.msg);

        APIJsonResponse::api_error(
            translated_error.unwrap_or(&"Unknown error").to_string(),
            internal_error.engineering_error,
        )
    }
    pub fn api_error(msg: String, eng_err: Option<String>) -> APIJsonResponse {
        APIJsonResponse {
            json: json!(APIResponse {
                success: false,
                result: APIError {
                    message: msg.to_string(),
                    engineeringError: eng_err
                }
            }),
            status: Status::Ok,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(non_snake_case)]
pub struct APIError {
    pub message: String,
    pub engineeringError: Option<String>,
}

impl<'r> Responder<'r> for APIJsonResponse {
    fn respond_to(self, req: &Request) -> response::Result<'r> {
        Response::build_from(self.json.respond_to(&req).unwrap())
            .status(self.status)
            .header(ContentType::JSON)
            .ok()
    }
}

#[derive(Debug)]
pub struct Storage {
    pub redis: Option<redis::Client>,
    pub database: Pool<PostgresConnectionManager<NoTls>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(non_snake_case)]
pub struct CommandResponse {
    pub correlation_id: Option<String>,
    pub commandStatus: CommandState,
    pub error: Option<String>,
}

#[cfg(test)]
mod test {
    use chrono::{DateTime, Datelike, Timelike};

    #[test]
    fn test_date_parser() {
        let exp_date = "2018-02-04T04:03:46.597Z";
        let result = DateTime::parse_from_rfc3339(exp_date).unwrap();
        assert_eq!(result.date().year(), 2018);
        assert_eq!(result.date().month(), 2);
        assert_eq!(result.date().day(), 4);
        assert_eq!(result.time().hour(), 4);
        assert_eq!(result.time().minute(), 03);
        assert_eq!(result.time().second(), 46);
    }
}
