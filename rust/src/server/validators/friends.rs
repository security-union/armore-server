use crate::lang::TranslationIds;
use crate::model::{responses::Errors::APIInternalError, PostgresConnection};

pub fn assert_not_friends(
    conn: &mut PostgresConnection,
    user1: &String,
    user2: &String,
) -> Result<(), APIInternalError> {
    conn.query(
        "SELECT * FROM users_followers WHERE username IN ($1, $2) AND username_follower IN ($1, $2)",
        &[user1, user2],
    )
    .map_err(|w| APIInternalError::from_db_err(w))
    .and_then(|rows| {
        rows.into_iter().next()
            .ok_or(APIInternalError {
                msg: TranslationIds::InvitationsYouAreNotFriends,
                engineering_error: None
            })
    })
    .and_then(|_| Ok(()))
}
