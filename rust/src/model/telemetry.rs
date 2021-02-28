use super::{
    devices::BatteryState,
    emergency::{AccessType, UserState},
    UserDetails,
};
use crate::constants::DATE_FORMAT;
use chrono::NaiveDateTime;
use postgres_types::{FromSql, ToSql};
use serde::ser::{SerializeStruct, Serializer};
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


#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
#[postgres(name = "command")]
pub enum Command {
    RefreshTelemetry,
}


#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
#[postgres(name = "commandstate")]
pub enum CommandState {
    Created,
    Completed,
    Error,
}

#[derive(Debug, Clone)]
pub struct Location {
    pub data: String,
    pub timestamp: NaiveDateTime,
    pub device_id: String,
}

impl Serialize for Location {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut s = serializer.serialize_struct("Location", 3)?;
        s.serialize_field("data", &self.data)?;
        s.serialize_field("device_id", &self.device_id)?;
        s.serialize_field("timestamp", &self.timestamp.format(DATE_FORMAT).to_string())?;
        s.end()
    }
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
