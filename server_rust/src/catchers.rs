use crate::rocket::Catcher;
use crate::model::{APIError, APIResponse};
use crate::rocket::{self, Request};
use crate::rocket_contrib::json::Json;

#[catch(403)]
fn forbidden(_req: &Request) -> Json<APIResponse<APIError>> {
    Json(APIResponse {
        success: false,
        result: APIError {
            message: "Unauthorized".to_string(),
            engineeringError: Some("The JWT Token is not good".to_string()),
        },
    })
}

#[catch(404)]
fn not_found(_req: &Request) -> Json<APIResponse<APIError>> {
    Json(APIResponse {
        success: false,
        result: APIError {
            message: "Unable to find endpoint".to_string(),
            engineeringError: Some("Unable to find endpoint".to_string()),
        },
    })
}

pub fn catchers() -> Vec<Catcher> {
    catchers![not_found, forbidden]
}
