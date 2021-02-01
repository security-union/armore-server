use crate::lang::TranslationIds;
use crate::model::{
    invitations::{InvitationState, LinkActionData},
    responses::Errors::APIInternalError,
    PostgresConnection,
};
use chrono::Utc;
use postgres::row::Row;

pub fn assert_valid_invitation(
    conn: &mut PostgresConnection,
    data: &LinkActionData,
) -> Result<(), APIInternalError> {
    get_invitation(conn, &data.uuid).and_then(|row| {
        assert_invitation_creator(&row, &data.username).and_then(|_| assert_link_state(conn, &row))
    })
}

fn assert_invitation_creator(row: &Row, username: &str) -> Result<(), APIInternalError> {
    let creator: String = row.get("creator_username");
    if creator == username {
        return Err(APIInternalError {
            msg: TranslationIds::CannotUseOwnInvitation,
            engineering_error: None
        })
    }
    Ok(())
}

fn assert_link_state(conn: &mut PostgresConnection, row: &Row) -> Result<(), APIInternalError> {
    let state: InvitationState = row.get("state");
    match state {
        InvitationState::CREATED => assert_exp_date(conn, row),
        _ => Err(APIInternalError {
            msg: TranslationIds::InvitationsInvitationIsNoLongerValid,
            engineering_error: None,
        }),
    }
}

fn assert_exp_date(conn: &mut PostgresConnection, row: &Row) -> Result<(), APIInternalError> {
    let exp_date: chrono::NaiveDateTime = row.get("expiration_timestamp");
    let id: String = row.get("id");
    let exp_date = exp_date.timestamp();
    let now = Utc::now().timestamp();

    if exp_date > now {
        Ok(())
    } else {
        set_invitation_expired(conn, id)
    }
}

fn get_invitation(conn: &mut PostgresConnection, id: &str) -> Result<Row, APIInternalError> {
    conn.query(
        "SELECT * FROM link_invitations WHERE id = $1",
        &[&id.to_string()],
    )
    .map_err(|w| APIInternalError::from_db_err(w))
    .and_then(|rows| {
        rows.into_iter().next().ok_or(APIInternalError {
            msg: TranslationIds::InvitationsInvitationDoesNotExist,
            engineering_error: None,
        })
    })
}

fn set_invitation_expired(
    conn: &mut PostgresConnection,
    id: String,
) -> Result<(), APIInternalError> {
    conn.execute(
        "UPDATE link_invitations SET state = $1 WHERE id = $2",
        &[&InvitationState::EXPIRED, &id],
    )
    .map_err(|w| APIInternalError::from_db_err(w))
    .and_then(|_| {
        Err(APIInternalError {
            msg: TranslationIds::InvitationsInvitationIsNoLongerValid,
            engineering_error: None,
        })
    })
}
