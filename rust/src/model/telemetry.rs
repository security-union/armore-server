use super::{
    devices::BatteryState,
    emergency::{AccessType, UserState},
    UserDetails,
};

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
