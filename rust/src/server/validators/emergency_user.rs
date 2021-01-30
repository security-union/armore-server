use crate::lang::TranslationIds;
use crate::model::{emergency::UserState, responses::Errors::APIInternalError, PostgresConnection};

pub fn assert_emergency_user(
    conn: &mut PostgresConnection,
    username: &String,
) -> Result<(), APIInternalError> {
    conn.query(
        "SELECT * FROM users_state WHERE username = $1 AND self_perception = $2",
        &[username, &UserState::Emergency],
    )
    .map_err(|w| APIInternalError::from_db_err(w))
    .and_then(|rows| {
        rows.into_iter().next().ok_or(APIInternalError {
            msg: TranslationIds::UserNotInEmergency,
            engineering_error: None,
        })
    })
    .and_then(|_| Ok(()))
}
