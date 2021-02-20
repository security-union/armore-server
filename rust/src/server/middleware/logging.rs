use logger::LogLevel;
use rocket::fairing::AdHoc;
use serde_json::Value;
use rocket_sentry_logger as logger;

pub fn api_json_response_fairing(service: Option<&'static str>) -> AdHoc {
    AdHoc::on_response("APIJsonResponse Fairing", move |_req, resp| {
        let body_str = resp.body_string().unwrap_or("".into());
        let body = json!(body_str);

        if let Value::Bool(false) = body["success"] {
            logger::set_tag("service", service.unwrap_or("Unknown"));
            logger::add_data("Response", body["result"].clone());
            logger::log(&format!("{}", body["result"]["message"]), LogLevel::Error);
        }
    })
}