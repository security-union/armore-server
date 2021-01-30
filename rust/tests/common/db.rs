use chrono::DateTime;
use lib::{db::get_pool, model::invitations::InvitationState};
use std::time::SystemTime;

pub fn insert_mock_public_key(username: &str, public_key: &str) {
    let pool = get_pool();
    let mut client = pool.get().unwrap();
    client
        .query(
            "INSERT INTO users_identity (username, public_key, update_timestamp)
                VALUES ($1, $2, now())
                ON CONFLICT (username)
                    DO UPDATE
                    SET public_key = $2, update_timestamp = now()
                ",
            &[&username.to_string(), &public_key.to_string()],
        )
        .unwrap();
}

pub fn insert_mock_invitation_link(
    username: &str,
    link_id: &str,
    exp_date: &str,
    state: InvitationState,
    recipient_username: &Option<String>,
) {
    let pool = get_pool();
    let mut client = pool.get().unwrap();
    let parsed_date = DateTime::parse_from_rfc3339(exp_date).unwrap();

    client
            .query(
                "INSERT INTO 
                link_invitations(id, expiration_timestamp, creator_username, state, recipient_username)
                VALUES ($1, $2, $3, $4, $5)",
                &[
                    &link_id.to_string(),
                    &SystemTime::from(parsed_date),
                    &username.to_string(),
                    &state,
                    &recipient_username
                ],
            )
            .unwrap();
}

pub fn insert_mock_friends(user1: &str, user2: &str) {
    let pool = get_pool();
    let mut client = pool.get().unwrap();

    client
        .query(
            "call add_friend($1, $2)",
            &[&user1.to_string(), &user2.to_string()],
        )
        .unwrap();
}

pub fn insert_mock_telemetry(
    username: &str,
    phone: &str,
    recipient: &str,
    datetime: chrono::NaiveDateTime,
) {
    let pool = get_pool();
    let mut client = pool.get().unwrap();
    let insert_query = "INSERT INTO device_telemetry (username, device_id, recipient_username, encrypted_location, creation_timestamp) VALUES ($1, $2, $3, $4, $5)";

    client
        .execute(
            insert_query,
            &[
                &username.to_string(),
                &phone.to_string(),
                &recipient.to_string(),
                &"encryptedData".to_string(),
                &datetime,
            ],
        )
        .unwrap();
}
