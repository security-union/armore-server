use super::responses::APIJsonResponse;
use chrono::{DateTime, Utc};
use postgres_types::{FromSql, ToSql};
use serde::{Deserialize, Serialize};

#[postgres(name = "link_invitation_state")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum InvitationState {
    CREATED,
    REJECTED,
    ACCEPTED,
    EXPIRED,
}

#[derive(Debug, Clone)]
pub struct LinkActionData {
    pub uuid: String,
    pub username: String,
}

#[derive(Debug, Clone)]
pub struct LinkCreationData {
    pub username: String,
    pub exp_date: DateTime<Utc>,
    pub uuid: String,
}

impl LinkCreationData {
    pub fn new(uuid: String, username: String, exp_date: String) -> Result<Self, APIJsonResponse> {
        if let Some(date_time) = Self::assert_exp_date(&exp_date) {
            Ok(Self {
                uuid,
                exp_date: date_time,
                username,
            })
        } else {
            return Err(APIJsonResponse::api_error(
                "Invalid creation timestamp".to_string(),
                None,
            ));
        }
    }

    fn assert_exp_date(exp_date: &str) -> Option<DateTime<Utc>> {
        let now = Utc::now();
        if let Ok(exp) = DateTime::parse_from_rfc3339(exp_date) {
            if exp >= now {
                return Some(exp.with_timezone(&Utc));
            }
        }
        return None;
    }
}
