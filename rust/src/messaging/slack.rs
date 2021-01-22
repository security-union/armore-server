use reqwest::Response;
use reqwest::{Error, StatusCode};
use std::collections::HashMap;
use std::env;

pub async fn send_nanny_slack_message(message: String) -> Result<Response, Error> {
    debug!("sending slack message {}", message);
    let slack_url = env::var("SLACK_NANNY_URL").expect("SLACK_NANNY_URL must be set");
    let client = reqwest::Client::new();
    let mut map = HashMap::new();
    map.insert("text", message);
    let result = client.post(slack_url.as_str()).json(&map).send().await;
    match &result {
        Ok(command_response) => info!("status {}", command_response.status()),
        Err(error) => error!(
            "force_result error {}",
            &error.status().clone().unwrap_or(StatusCode::BAD_REQUEST)
        ),
    }
    return result;
}