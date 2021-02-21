use std::{io::Cursor, str::FromStr};

use logger::LogLevel;
use rocket::fairing::AdHoc;
use rocket_sentry_logger as logger;
use serde_json::Value;

pub fn api_json_response_fairing() -> AdHoc {
    AdHoc::on_response("APIJsonResponse Fairing", move |_req, resp| {
        let body_str = resp.body_string().unwrap_or_default();
        let body = serde_json::Value::from_str(&body_str).unwrap_or_default();
        if let Value::Bool(false) = body["success"] {
            logger::add_data("Response", body["result"].clone());
            logger::log(&format!("{}", body["result"]["message"]), LogLevel::Error);
        }
        resp.set_sized_body(Cursor::new(body_str));
    })
}
