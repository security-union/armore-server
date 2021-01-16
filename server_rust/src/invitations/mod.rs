pub mod handlers;

use crate::db::{telemetry::postgres_to_api, transaction};
use crate::model::{
    APIInternalError, AcceptedNotificationData, InvitationState, LinkActionData, LinkCreationData,
    NotificationData, PostgresConnection,
};
use crate::publish_websocket_messages::{build_user_push_notifications, send_notification};
use crate::strings::{get_dictionary, TranslationIds};
use amiquip::{Channel, Result};
use chrono::Utc;
use postgres::row::Row;
use rocket_contrib::json::JsonValue;
use std::time::SystemTime;

const INV_ENDPOINT: &str = "https://armore.dev/invitations";

/// Try to insert the data into the Database
/// If OK, generate the link and return it
pub fn create_invitation(
    mut conn: PostgresConnection,
    data: LinkCreationData,
) -> Result<String, APIInternalError> {
    conn.query("INSERT INTO link_invitations(id, expiration_timestamp, creator_username) VALUES ($1, $2, $3)",
        &[&data.uuid, &SystemTime::from(data.exp_date), &data.username],
    )
    .and_then(|_| Ok(format!("{}/{}", INV_ENDPOINT, data.uuid)))
    .map_err(|w| postgres_to_api(w))
}

/// Tries to set the State of an invitation
/// to REJECTED
pub fn reject_invitation(
    mut conn: PostgresConnection,
    data: LinkActionData,
) -> Result<(), APIInternalError> {
    conn.execute(
        "UPDATE link_invitations SET state = $3, recipient_username = $1 WHERE id = $2",
        &[&data.username, &data.uuid, &InvitationState::REJECTED],
    )
    .and_then(|_| Ok(()))
    .map_err(|w| postgres_to_api(w))
}

/// Try to set the State of an invitation to ACCEPTED.
/// Start a transaction to add following users
pub fn accept_invitation(
    conn: &mut PostgresConnection,
    data: &LinkActionData,
) -> Result<(), APIInternalError> {
    transaction(conn, |ts| {
        ts.execute(
            "UPDATE link_invitations SET state = $1, recipient_username = $2 WHERE id = $3",
            &[&InvitationState::ACCEPTED, &data.username, &data.uuid],
        )
        .and_then(|_| {
            ts.query_one(
                "SELECT * FROM link_invitations WHERE id = $1",
                &[&data.uuid],
            )
        })
        .and_then(|row| {
            let user1: String = row.get("creator_username");
            let user2: String = row.get("recipient_username");
            ts.execute("call add_friend($1, $2)", &[&user1, &user2])
        })
        .and_then(|_| Ok(()))
    })
    .map_err(|w| APIInternalError {
        msg: TranslationIds::BackendIssue,
        engineering_error: Some(w.to_string()),
    })
}

pub fn notify_accepted(
    conn: &mut PostgresConnection,
    channel: &Channel,
    data: &LinkActionData,
) -> Result<(), APIInternalError> {
    conn.query_one(
        "SELECT
            inv.creator_username as creator,
            creator_user_details.language as lang,
            recipient_user_details.first_name as first_name
         FROM link_invitations inv
         INNER JOIN user_details recipient_user_details
            ON inv.id = $1 AND inv.recipient_username = recipient_user_details.username
         INNER JOIN user_details creator_user_details
            ON inv.id = $1 AND inv.creator_username = creator_user_details.username",
        &[&data.uuid],
    )
    .and_then(|row| {
        Ok(AcceptedNotificationData {
            creator: row.get("creator"),
            language: row.get("lang"),
            recipient: row.get("first_name"),
        })
    })
    .map_err(|w| APIInternalError {
        msg: TranslationIds::BackendIssue,
        engineering_error: Some(w.to_string()),
    })
    .and_then(|inv_data| push_accepted_notification(conn, channel, &inv_data))
}

fn push_accepted_notification(
    conn: &mut PostgresConnection,
    channel: &Channel,
    data: &AcceptedNotificationData,
) -> Result<(), APIInternalError> {
    let push_inv_title = get_dictionary(data.language.clone())
        .get(&TranslationIds::PushNotificationInvitationAcceptedTitle)
        .unwrap_or(&"Unknow Error");
    let push_inv_body = get_dictionary(data.language.clone())
        .get(&TranslationIds::PushNotificationInvitationAcceptedBody)
        .unwrap_or(&"Unknow Error");
    let title = format!("{} {}", &data.recipient, push_inv_title);
    let body = format!("{} {}", &data.recipient, push_inv_body);

    send_notification(
        channel,
        json!(build_user_push_notifications(
            &NotificationData {
                username: data.creator.clone(),
                title,
                body,
            },
            conn
        )).to_string(),
    )
    .map_err(|w| APIInternalError {
        msg: TranslationIds::BackendIssue,
        engineering_error: Some(w.to_string()),
    })
}

pub fn remove_friends(
    mut conn: PostgresConnection,
    user1: &str,
    user2: &str,
) -> Result<(), APIInternalError> {
    conn.execute("call remove_friend($1, $2)", &[&user1, &user2])
        .and_then(|_| Ok(()))
        .map_err(|w| postgres_to_api(w))
}

pub fn get_invitation_creator(
    conn: &mut PostgresConnection,
    id: &str,
) -> Result<JsonValue, APIInternalError> {
    get_inv_creator(conn, id).and_then(|row| {
        let first_name: String = row.get("first_name");
        let last_name: String = row.get("last_name");
        Ok(json!({
            "firstName": first_name,
            "lastName": last_name
        }))
    })
}

fn get_inv_creator(conn: &mut PostgresConnection, id: &str) -> Result<Row, APIInternalError> {
    conn.query(
        "SELECT ud.first_name, ud.last_name 
        FROM link_invitations lnk 
        INNER JOIN user_details ud
        ON lnk.id = $1 AND ud.username = lnk.creator_username",
        &[&id.to_string()],
    )
    .map_err(|w| postgres_to_api(w))
    .and_then(|rows| {
        rows.into_iter().next().ok_or(APIInternalError {
            msg: TranslationIds::InvitationsInvitationDoesNotExist,
            engineering_error: None,
        })
    })
}

fn get_invitation(conn: &mut PostgresConnection, id: &str) -> Result<Row, APIInternalError> {
    conn.query(
        "SELECT * FROM link_invitations WHERE id = $1",
        &[&id.to_string()],
    )
    .map_err(|w| postgres_to_api(w))
    .and_then(|rows| {
        rows.into_iter().next().ok_or(APIInternalError {
            msg: TranslationIds::InvitationsInvitationDoesNotExist,
            engineering_error: None,
        })
    })
}

/****************/
/** ASSERTIONS **/
/****************/

pub fn assert_not_friends(
    conn: &mut PostgresConnection,
    user1: &String,
    user2: &String,
) -> Result<(), APIInternalError> {
    conn.query(
        "SELECT * FROM users_followers WHERE username IN ($1, $2) AND username_follower IN ($1, $2)",
        &[user1, user2],
    )
    .map_err(|w| postgres_to_api(w))
    .and_then(|rows| {
        rows.into_iter().next()
            .ok_or(APIInternalError {
                msg: TranslationIds::InvitationsYouAreNotFriends,
                engineering_error: None
            })
    })
    .and_then(|_| Ok(()))
}

pub fn assert_valid_invitation(
    conn: &mut PostgresConnection,
    data: &LinkActionData,
) -> Result<(), APIInternalError> {
    get_invitation(conn, &data.uuid).and_then(|row| assert_link_state(conn, &row))
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

fn set_invitation_expired(
    conn: &mut PostgresConnection,
    id: String,
) -> Result<(), APIInternalError> {
    conn.execute(
        "UPDATE link_invitations SET state = $1 WHERE id = $2",
        &[&InvitationState::EXPIRED, &id],
    )
    .map_err(|w| postgres_to_api(w))
    .and_then(|_| {
        Err(APIInternalError {
            msg: TranslationIds::InvitationsInvitationIsNoLongerValid,
            engineering_error: None,
        })
    })
}

