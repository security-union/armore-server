use postgres_types::{FromSql, ToSql};
use serde::{Deserialize, Serialize};

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

#[postgres(name = "locationpermissionstate")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum LocationPermissionState {
    ALWAYS,
    USING,
    ASK,
    NEVER,
    UNKNOWN,
}

#[postgres(name = "appstate")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum AppState {
    Background,
    Foreground,
    UNKNOWN,
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
#[allow(non_camel_case_types)]
#[postgres(name = "os")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum OS {
    Android,
    iOS,
    UNKNOWN,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatteryState {
    pub batteryLevel: Option<f64>,
    pub chargingState: Option<ChargingState>,
    pub isCharging: Option<bool>,
}
