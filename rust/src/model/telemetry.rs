use super::{
    devices::BatteryState,
    emergency::{AccessType, UserState},
    UserDetails,
};
use crate::constants::DATE_FORMAT;
use chrono::NaiveDateTime;
use postgres_types::{FromSql, ToSql};
use serde::{Deserialize, Serialize};

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Telemetry {
    pub data: String,
    pub timestamp: String,
    pub batteryState: Option<BatteryState>,
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone)]
pub struct FollowerKey {
    pub username: String,
    pub key: String,
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
pub struct Connection {
    pub userDetails: UserDetails,
    pub accessType: Option<AccessType>,
    pub telemetry: Option<Telemetry>,
    pub state: Option<UserState>,
    pub publicKey: Option<String>,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Location {
    pub data: String,
    pub timestamp: String,
    pub device_id: String,
}

#[derive(Debug, Clone)]
pub struct DateTimeRange {
    pub start_time: NaiveDateTime,
    pub end_time: NaiveDateTime,
}

impl DateTimeRange {
    pub fn from_str(start_time: &str, end_time: &str) -> Result<DateTimeRange, String> {
        let start_time = NaiveDateTime::parse_from_str(start_time, DATE_FORMAT)
            .or_else(|err| Err(err.to_string()))?;
        let end_time = NaiveDateTime::parse_from_str(end_time, DATE_FORMAT)
            .or_else(|err| Err(err.to_string()))?;
            
        if start_time <= end_time {
            Ok(DateTimeRange {
                start_time,
                end_time,
            })
        } else {
            Err(String::from("Invalid date range"))
        }
    }
}
