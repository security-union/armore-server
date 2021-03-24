use self::Errors::*;
use super::telemetry::{CommandState, Connection};
use crate::lang;
use rocket::http::{ContentType, Status};
use rocket::response::Responder;
use rocket::{response, Request, Response};
use rocket_contrib::json::JsonValue;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct APIResponse<A> {
    pub success: bool,
    pub result: A,
}

#[derive(Debug)]
#[allow(non_snake_case)]
pub struct APIJsonResponse {
    pub json: JsonValue,
    pub status: Status,
}

impl APIJsonResponse {
    pub fn api_error_with_internal_error(
        internal_error: APIInternalError,
        lang: &str,
    ) -> APIJsonResponse {
        let translated_error = lang::get_glossary(lang).get(&internal_error.msg);

        APIJsonResponse::api_error(
            translated_error.unwrap_or(&"Unknown error").to_string(),
            internal_error.engineering_error,
        )
    }
    pub fn api_error(msg: String, eng_err: Option<String>) -> APIJsonResponse {
        APIJsonResponse {
            json: json!(APIResponse {
                success: false,
                result: APIError {
                    message: msg.to_string(),
                    engineeringError: eng_err
                }
            }),
            status: Status::Ok,
        }
    }
}

impl<'r> Responder<'r> for APIJsonResponse {
    fn respond_to(self, req: &Request) -> response::Result<'r> {
        Response::build_from(self.json.respond_to(&req).unwrap())
            .status(self.status)
            .header(ContentType::JSON)
            .ok()
    }
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TelemetryResponse {
    pub followers: HashMap<String, Connection>,
    pub following: HashMap<String, Connection>,
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone)]
pub struct DeviceUpdateResponse {
    pub updated: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InvitationResponse {
    pub link: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(non_snake_case)]
pub struct CommandResponse {
    pub correlation_id: Option<String>,
    pub commandStatus: CommandState,
    pub error: Option<String>,
}

#[allow(non_snake_case)]
pub mod Errors {
    use crate::lang::TranslationIds;
    use crate::model::emergency::UserState;
    use rocket_sentry_logger as logger;
    use rocket_sentry_logger::LogLevel;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize, Clone)]
    #[allow(non_snake_case)]
    pub struct APIError {
        pub message: String,
        pub engineeringError: Option<String>,
    }

    #[derive(Debug)]
    pub struct APIInternalError {
        pub msg: TranslationIds,
        pub engineering_error: Option<String>,
    }

    impl APIInternalError {
        pub fn log_err(&self, message: &str) {
            logger::add_data(
                "Error data",
                serde_json::json!({
                    "message": message,
                    "engineering_error": self.engineering_error
                }),
            );
            logger::log(message, LogLevel::Error);
        }

        pub fn from_db_err<T: ToString>(e: T) -> Self {
            error!("Redis/Postgres error: {}", e.to_string());
            Self {
                msg: TranslationIds::DatabaseError,
                engineering_error: Some(e.to_string()),
            }
        }

        pub fn backend_issue<T: ToString>(e: T) -> Self {
            Self {
                msg: TranslationIds::BackendIssue,
                engineering_error: Some(e.to_string()),
            }
        }

        pub fn user_state_error(user_state: UserState) -> Self {
            Self {
                msg: match user_state {
                    UserState::Normal => TranslationIds::UserAlreadyInNormal,
                    UserState::Emergency => TranslationIds::UserAlreadyInEmergency,
                },
                engineering_error: None,
            }
        }
    }
}
