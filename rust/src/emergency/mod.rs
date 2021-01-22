pub mod handlers;

use crate::{
    constants::{CS_PROFILE_IMAGE_PATH, GENERIC_EMAIL_TEMPLATE, WEB_URL},
    db::telemetry::get_user_details,
    lang::{get_dictionary, TranslationIds},
    messaging::{build_user_push_notifications, send_notification},
    model::{
        emergency::UserState,
        notifications::{
            DynamicEmailTemplateData, Email, NotificationData, NotificationRecipient,
            PushNotification,
        },
        responses::Errors::APIInternalError,
        PostgresConnection, UserDetails,
    },
};
use amiquip::{Channel, Result};
use rocket_contrib::json::JsonValue;

pub fn update_user_state(
    conn: &mut PostgresConnection,
    username: &String,
    state: UserState,
) -> Result<(), APIInternalError> {
    conn.execute(
        "UPDATE users_state set self_perception = $1 where username = $2 AND self_perception != $1",
        &[&state, username],
    )
    .map_err(|w| APIInternalError {
        msg: TranslationIds::BackendIssue,
        engineering_error: Some(w.to_string()),
    })
    .and_then(|updated_rows| {
        if updated_rows < 1 {
            Err(APIInternalError::user_state_error(state))
        } else {
            Ok(())
        }
    })
}

pub fn send_emergency_notifications(
    conn: &mut PostgresConnection,
    channel: &Channel,
    username: &String,
    state: &UserState,
) -> Result<(), APIInternalError> {
    let sender_details = get_user_details(username, conn)
        .map_err(|w| APIInternalError::from_postgres_err(w))?
        .unwrap();

    get_emergency_connections(conn, username)
        .map_err(|w| APIInternalError::from_postgres_err(w))
        .map(|recipients| build_recipients_notifications(conn, recipients, &sender_details, state))
        .and_then(|values| {
            send_notification(channel, json!(values).to_string()).map_err(|w| APIInternalError {
                msg: TranslationIds::BackendIssue,
                engineering_error: Some(w.to_string()),
            })
        })
}

fn build_recipients_notifications(
    conn: &mut PostgresConnection,
    recipients: Vec<NotificationRecipient>,
    sender_details: &UserDetails,
    state: &UserState,
) -> Vec<JsonValue> {
    recipients
        .iter()
        .flat_map(|recipient| {
            let (push_not, emails) =
                build_emergency_notifications(conn, &sender_details, &recipient.username, state);
            push_not
                .into_iter()
                .map(|not| json!(not))
                .chain(emails.into_iter().map(|m| json!(m)))
        })
        .collect()
}

fn build_emergency_notifications(
    conn: &mut PostgresConnection,
    sender_details: &UserDetails,
    rec_username: &String,
    state: &UserState,
) -> (Vec<PushNotification>, Vec<Email>) {
    get_user_details(rec_username, conn)
        .ok()
        .flatten()
        .map_or((vec![], vec![]), |rec_details| {
            let notifications =
                build_emergency_notification(conn, &sender_details, &rec_details, &state);
            let email = build_emergency_email(&sender_details, &rec_details, &state);
            (notifications, vec![email])
        })
}

fn build_emergency_notification(
    conn: &mut PostgresConnection,
    sender: &UserDetails,
    recipient: &UserDetails,
    state: &UserState,
) -> Vec<PushNotification> {
    let data = build_notification_data_from_recipient(sender, recipient, state);
    build_user_push_notifications(&data, conn)
}

fn build_emergency_email(
    sender: &UserDetails,
    recipient: &UserDetails,
    state: &UserState,
) -> Email {
    let data = build_notification_data_from_recipient(sender, recipient, state);
    let link = get_dictionary(recipient.language.clone().unwrap())
        .get(&TranslationIds::PushNotificationActionView)
        .unwrap()
        .to_string();
    Email {
        username: recipient.username.clone(),
        email: recipient.email.clone().unwrap(),
        templateId: GENERIC_EMAIL_TEMPLATE.to_string(),
        dynamicTemplateData: DynamicEmailTemplateData {
            title: data.title,
            body: data.body,
            picture: if let Some(picture) = sender.picture.clone() {
                Some(format!("{}/{}", CS_PROFILE_IMAGE_PATH, picture))
            } else {
                None
            },
            linkTitle: WEB_URL.to_string(),
            link: Some(link),
        },
    }
}

fn build_notification_data_from_recipient(
    sender: &UserDetails,
    recipient: &UserDetails,
    state: &UserState,
) -> NotificationData {
    let body = get_dictionary(recipient.language.clone().unwrap())
        .get(match state {
            UserState::Emergency => &TranslationIds::EmergencyModePushNotificationBody,
            UserState::Normal => &TranslationIds::NormalModePushNotificationBody,
        })
        .unwrap();
    let body = format!("{} {} {}", sender.firstName, sender.lastName, body);
    NotificationData {
        username: recipient.username.clone(),
        title: "RescueLink SOS".to_string(),
        body,
    }
}

pub fn get_emergency_connections(
    conn: &mut PostgresConnection,
    username: &String,
) -> Result<Vec<NotificationRecipient>, postgres::Error> {
    conn.query(
        "SELECT users.username, users.email
        FROM users
        INNER JOIN users_followers usf ON 
        usf.username = $1 AND
        usf.is_emergency_contact = true AND
        usf.username_follower = users.username",
        &[username],
    )
    .map(|results| {
        results
            .into_iter()
            .map(|row| NotificationRecipient {
                email: row.get("email"),
                username: row.get("username"),
            })
            .collect()
    })
}
