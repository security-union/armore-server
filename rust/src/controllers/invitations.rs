use crate::db::transaction;
use crate::lang::{get_glossary, TranslationIds};
use crate::messaging::{build_user_push_notifications, get_rabbitmq_uri, send_notification};
use crate::model::{
    invitations::{InvitationState, LinkActionData, LinkCreationData},
    notifications::{AcceptedNotificationData, NotificationData},
    responses::Errors::APIInternalError,
    PostgresConnection,
};
use crate::constants::INV_ENDPOINT;
use amiquip::Connection as RabbitConnection;
use amiquip::Result;

use postgres::row::Row;
use rocket_contrib::json::JsonValue;
use std::time::SystemTime;

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
    .map_err(APIInternalError::from_db_err)
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
    .map_err(APIInternalError::from_db_err)
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
    .map_err(APIInternalError::backend_issue)
}

pub fn notify_accepted(
    conn: &mut PostgresConnection,
    data: &LinkActionData,
) -> Result<(), APIInternalError> {
    return conn
        .query_one(
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
        .map_err(APIInternalError::backend_issue)
        .and_then(|inv_data| push_accepted_notification(conn, &inv_data));
}

fn push_accepted_notification(
    conn: &mut PostgresConnection,
    data: &AcceptedNotificationData,
) -> Result<(), APIInternalError> {
    let notification = get_push_inv_notification(conn, data);

    RabbitConnection::insecure_open(&get_rabbitmq_uri())
        .and_then(|mut connection| connection.open_channel(None))
        .and_then(|channel| {
            let result = send_notification(&channel, notification.to_string());
            let _ = channel.close();
            result
        })
        .map_err(APIInternalError::backend_issue)
}

pub fn remove_friends(
    mut conn: PostgresConnection,
    user1: &str,
    user2: &str,
) -> Result<(), APIInternalError> {
    conn.execute("call remove_friend($1, $2)", &[&user1, &user2])
        .and_then(|_| Ok(()))
        .map_err(APIInternalError::from_db_err)
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
    .map_err(APIInternalError::from_db_err)
    .and_then(|rows| {
        rows.into_iter().next().ok_or(APIInternalError {
            msg: TranslationIds::InvitationsInvitationDoesNotExist,
            engineering_error: None,
        })
    })
}


fn get_push_inv_notification(
    conn: &mut PostgresConnection,
    data: &AcceptedNotificationData,
) -> JsonValue {
    let push_inv_title = get_glossary(&data.language)
        .get(&TranslationIds::PushNotificationInvitationAcceptedTitle)
        .unwrap_or(&"Unknow Error");
    let push_inv_body = get_glossary(&data.language)
        .get(&TranslationIds::PushNotificationInvitationAcceptedBody)
        .unwrap_or(&"Unknown error getting translated string");
    let title = format!("{} {}", &data.recipient, push_inv_title);
    let body = format!("{} {}", &data.recipient, push_inv_body);

    json!(build_user_push_notifications(
        &NotificationData {
            username: data.creator.clone(),
            title,
            body,
        },
        conn
    ))
}
