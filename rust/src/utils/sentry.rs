use crate::model::auth::AuthInfo;
use crate::model::responses::Errors::APIInternalError;
use rocket_sentry_logger::{self as logger, LogLevel};
use serde_json::json;
use std::collections::BTreeMap;

pub fn log_api_err(endpoint: &str, err: &APIInternalError, auth_info: Option<&AuthInfo>) {
    if let Some(info) = auth_info {
        set_user(info);
    }
    logger::add_data("Error data", json!(err));
    logger::log(
        &format!("{}\n{}", endpoint, json!(err.msg)),
        LogLevel::Error,
    );
}

fn set_user(auth_info: &AuthInfo) {
    let user_data: BTreeMap<String, serde_json::Value> = vec![(
        "device_id".into(),
        serde_json::json!(auth_info.deviceId.clone()),
    )]
    .into_iter()
    .collect();
    let user = logger::User {
        username: Some(auth_info.username.clone()),
        other: user_data,
        ..Default::default()
    };
    logger::set_user(user);
}
