use super::devices::{AppState, BatteryState, LocationPermissionState};
use super::telemetry::TelemetryUpdate;
use serde::{Deserialize, Serialize};

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
pub struct TelemetryRequest {
    pub returnFriendLocations: bool,
    pub telemetry: Vec<TelemetryUpdate>,
    pub appState: Option<AppState>,
    pub batteryState: Option<BatteryState>,
    pub correlationId: Option<String>,
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InvitationRequest {
    pub expirationDate: String,
}
