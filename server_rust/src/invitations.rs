#![feature(proc_macro_hygiene, decl_macro)]
extern crate log;

#[macro_use]
extern crate rocket;

use lib::model::APIJsonResponse;
use lib::{
    cors::options,
    db::{
        get_connection, get_pool,
        link_inv_db::{
            accept_invitation, assert_not_friends, assert_valid_invitation, create_invitation,
            get_invitation_creator, notify_accepted, reject_invitation, remove_friends,
        },
    },
    model::{
        APIError, APIResponse, APIResult, AuthInfo, InvitationReq, InvitationResp, LinkActionData,
        LinkCreationData, Message, Storage,
    },
};
use rocket::{Request, Rocket, State};
use rocket_contrib::json::{Json, JsonValue};
use uuid::Uuid;

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

/// Create a new invitation link from post request
/// Requires client AuthInfo and the expiration date
/// Returns the generated link for this invitation
#[post("/", format = "application/json", data = "<invitation_req>")]
fn create(
    invitation_req: Json<InvitationReq>,
    auth_info: AuthInfo,
    state: State<Storage>,
) -> APIResult<InvitationResp> {
    // Get the basic data to create a new invitation_link instance
    let data = LinkCreationData::new(
        Uuid::new_v4().to_string(),
        auth_info.username.clone(),
        invitation_req.expirationDate.clone(),
    )?;
    get_connection(state)
        .and_then(|conn| {
            create_invitation(conn, data).and_then(|link| {
                Ok(Json(APIResponse {
                    success: true,
                    result: Some(InvitationResp { link }),
                }))
            })
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, auth_info.language))
}

#[post("/<id>/reject")]
fn reject(id: String, auth_info: AuthInfo, state: State<Storage>) -> APIResult<Message> {
    let data = LinkActionData {
        uuid: id.clone(),
        username: auth_info.username.clone(),
    };

    get_connection(state)
        .and_then(|mut conn| {
            assert_valid_invitation(&mut conn, &data)
                .and_then(|_| reject_invitation(conn, data))
                .and_then(|_| {
                    Ok(Json(APIResponse {
                        success: true,
                        result: Some(Message {
                            message: "Ok".to_string(),
                        }),
                    }))
                })
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, auth_info.language))
}

#[post("/<id>/accept")]
fn accept(id: String, auth_info: AuthInfo, state: State<Storage>) -> APIResult<Message> {
    let data = LinkActionData {
        uuid: id.clone(),
        username: auth_info.username.clone(),
    };

    get_connection(state)
        .and_then(|mut conn| {
            assert_valid_invitation(&mut conn, &data)
                .and_then(|_| accept_invitation(&mut conn, &data))
                .and_then(|_| notify_accepted(&mut conn, &data))
                .and_then(|_| {
                    Ok(Json(APIResponse {
                        success: true,
                        result: Some(Message {
                            message: "Ok".to_string(),
                        }),
                    }))
                })
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, auth_info.language))
}

#[delete("/remove/<username>")]
fn remove_friend(
    username: String,
    auth_info: AuthInfo,
    state: State<Storage>,
) -> APIResult<Message> {
    get_connection(state)
        .and_then(|mut conn| {
            assert_not_friends(&mut conn, &auth_info.username, &username)
                .and_then(|_| remove_friends(conn, &auth_info.username, &username))
                .and_then(|_| {
                    Ok(Json(APIResponse {
                        success: true,
                        result: Some(Message {
                            message: "Ok".to_string(),
                        }),
                    }))
                })
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, auth_info.language))
}

#[get("/<id>/creator")]
fn get_creator(id: String, _auth_info: AuthInfo, state: State<Storage>) -> APIResult<JsonValue> {
    get_connection(state)
        .and_then(|mut conn| {
            get_invitation_creator(&mut conn, &id).and_then(|data| {
                Ok(Json(APIResponse {
                    success: true,
                    result: Some(data),
                }))
            })
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, _auth_info.language))
}

fn rocket() -> Rocket {
    let database = get_pool();
    rocket::ignite()
        .mount(
            "/v1/invitations",
            routes![create, accept, reject, remove_friend, get_creator],
        )
        .register(catchers![forbidden, not_found])
        .attach(options())
        .manage(Storage {
            redis: None,
            database,
        })
}

fn main() {
    env_logger::init();
    rocket().launch();
}

#[cfg(test)]
mod test {
    use chrono::{DateTime, Duration, Local};
    use lib::auth::{create_token, ASIMOV_LIVES, MOCK_PUBLIC_KEY};
    use lib::dbmate::dbmate_rebuild;
    use lib::{db::get_pool, model::InvitationState};
    use regex::Regex;
    use rocket::http::Header;
    use rocket::http::Status;
    use rocket::local::Client;
    use rocket_contrib::json;

    use super::rocket;
    use std::time::SystemTime;

    fn week() -> Duration {
        Duration::days(7)
    }

    fn insert_mock_public_key(username: &str, public_key: &str) {
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

    fn insert_mock_invitation_link(
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

    fn insert_mock_friends(user1: &str, user2: &str) {
        let pool = get_pool();
        let mut client = pool.get().unwrap();

        client
            .query(
                "call add_friend($1, $2)",
                &[&user1.to_string(), &user2.to_string()],
            )
            .unwrap();
    }

    #[test]
    fn test_auth_info() {
        dbmate_rebuild();
        let rocket = rocket();
        let client = Client::new(rocket).expect("valid rocket instance");
        let mut request = client.post("/v1/invitations");

        request.add_header(Header::new("Content-Type", "application/json"));
        request.add_header(Header::new(ASIMOV_LIVES, ""));

        let response = request.dispatch();
        assert_eq!(response.status(), Status::Forbidden);
    }

    #[test]
    fn test_create_invitation_link() {
        dbmate_rebuild();
        insert_mock_public_key("dario", MOCK_PUBLIC_KEY);

        let rocket = rocket();
        let pool = get_pool();
        let client = Client::new(rocket).expect("valid rocket instance");
        let token = create_token("dario", "dario_iphone").unwrap();
        let mut db_client = pool.get().unwrap();
        let expiration_date = Local::now() + week();
        let exp_date = expiration_date.to_rfc3339();
        let re = Regex::new(r#"\{"success":true,"result":\{"link":".*"\}\}"#).unwrap();
        let mut request = client.post("/v1/invitations");

        request.add_header(Header::new("Content-Type", "application/json"));
        request.add_header(Header::new(ASIMOV_LIVES, token));
        request.set_body(json!({ "expirationDate": &exp_date }).to_string());

        let mut response = request.dispatch();

        assert_eq!(response.status(), Status::Ok);
        assert!(
            re.is_match(&response.body_string().unwrap()),
            format!("actual {}", &response.body_string().unwrap())
        );

        let rows = db_client
            .query(
                "SELECT * FROM link_invitations WHERE expiration_timestamp = $1",
                &[&SystemTime::from(expiration_date)],
            )
            .unwrap();
        assert_eq!(rows.len(), 1)
    }

    #[test]
    fn test_create_invalid_timestamp() {
        dbmate_rebuild();
        insert_mock_public_key("dario", MOCK_PUBLIC_KEY);

        let rocket = rocket();
        let client = Client::new(rocket).expect("valid rocket instance");
        let token = create_token("dario", "dario_iphone").unwrap();

        let exp_date = "2018-02-04T04:03:46.597Z";
        let mut request = client.post("/v1/invitations");

        request.add_header(Header::new("Content-Type", "application/json"));
        request.add_header(Header::new(ASIMOV_LIVES, token));
        request.set_body(json!({ "expirationDate": &exp_date }).to_string());

        let mut response = request.dispatch();

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(
            r#"{"result":{"engineeringError":null,"message":"Invalid creation timestamp"},"success":false}"#,
            &response.body_string().unwrap()
        );
    }

    #[test]
    fn test_reject_created_invitation() {
        dbmate_rebuild();
        insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
        let token = create_token("coche", "coche_iphone").unwrap();

        let exp_date = (Local::now() + week()).to_rfc3339();
        let inv_id = "XjKlQptXcAeQ";
        insert_mock_invitation_link("dario", inv_id, &exp_date, InvitationState::CREATED, &None);

        let rocket = rocket();
        let client = Client::new(rocket).expect("valid rocket instance");
        let mut request = client.post(format!("/v1/invitations/{}/reject", inv_id));
        request.add_header(Header::new(ASIMOV_LIVES, token));
        let mut response = request.dispatch();

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(
            r#"{"success":true,"result":{"message":"Ok"}}"#,
            &response.body_string().unwrap()
        );
    }

    #[test]
    fn test_reject_rejected_invitation() {
        dbmate_rebuild();
        insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
        let token = create_token("coche", "coche_iphone").unwrap();

        let exp_date = (Local::now() + week()).to_rfc3339();
        let inv_id = "XjKlQptXcAeQ";
        insert_mock_invitation_link("dario", inv_id, &exp_date, InvitationState::REJECTED, &None);

        let rocket = rocket();
        let client = Client::new(rocket).expect("valid rocket instance");
        let mut request = client.post(format!("/v1/invitations/{}/reject", inv_id));
        request.add_header(Header::new(ASIMOV_LIVES, token));
        let mut response = request.dispatch();

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(
            r#"{"result":{"engineeringError":null,"message":"The invitation is no longer valid"},"success":false}"#,
            &response.body_string().unwrap()
        );
    }

    #[test]
    fn test_reject_expired_invitation() {
        dbmate_rebuild();
        insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
        let token = create_token("coche", "coche_iphone").unwrap();

        let exp_date = (Local::now() - week()).to_rfc3339();
        let inv_id = "XjKlQptXcAeQ";
        insert_mock_invitation_link("dario", inv_id, &exp_date, InvitationState::CREATED, &None);

        let rocket = rocket();
        let client = Client::new(rocket).expect("valid rocket instance");
        let mut request = client.post(format!("/v1/invitations/{}/reject", inv_id));
        request.add_header(Header::new(ASIMOV_LIVES, token));
        let mut response = request.dispatch();

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(
            r#"{"result":{"engineeringError":null,"message":"The invitation is no longer valid"},"success":false}"#,
            &response.body_string().unwrap()
        );
    }

    #[test]
    fn test_access_to_invalid_invitation() {
        dbmate_rebuild();
        insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
        let token = create_token("coche", "coche_iphone").unwrap();

        let inv_id = "RandomId";

        let rocket = rocket();
        let client = Client::new(rocket).expect("valid rocket instance");
        let mut request = client.post(format!("/v1/invitations/{}/reject", inv_id));
        request.add_header(Header::new(ASIMOV_LIVES, token));
        let mut response = request.dispatch();

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(
            r#"{"result":{"engineeringError":null,"message":"There is no invitation with that id"},"success":false}"#,
            &response.body_string().unwrap()
        );
    }

    #[test]
    fn test_accept_invitation() {
        dbmate_rebuild();
        insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
        let token = create_token("coche", "coche_iphone").unwrap();

        let exp_date = (Local::now() + week()).to_rfc3339();
        let inv_id = "XjKlQptXcAeQ";
        insert_mock_invitation_link("dario", inv_id, &exp_date, InvitationState::CREATED, &None);

        let rocket = rocket();
        let client = Client::new(rocket).expect("valid rocket instance");
        let mut request = client.post(format!("/v1/invitations/{}/accept", inv_id));
        request.add_header(Header::new(ASIMOV_LIVES, token));
        let mut response = request.dispatch();

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(
            r#"{"success":true,"result":{"message":"Ok"}}"#,
            &response.body_string().unwrap()
        );
    }

    #[test]
    fn test_accept_accepted_invitation() {
        dbmate_rebuild();
        insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
        let token = create_token("coche", "coche_iphone").unwrap();

        let exp_date = (Local::now() + week()).to_rfc3339();
        let inv_id = "XjKlQptXcAeQ";
        insert_mock_invitation_link(
            "dario",
            inv_id,
            &exp_date,
            InvitationState::ACCEPTED,
            &Some("billburr".to_string()),
        );

        let rocket = rocket();
        let client = Client::new(rocket).expect("valid rocket instance");
        let mut request = client.post(format!("/v1/invitations/{}/accept", inv_id));
        request.add_header(Header::new(ASIMOV_LIVES, token));
        let mut response = request.dispatch();

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(
            r#"{"result":{"engineeringError":null,"message":"The invitation is no longer valid"},"success":false}"#,
            &response.body_string().unwrap()
        );
    }

    #[test]
    fn test_accept_already_friends() {
        dbmate_rebuild();
        insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
        let token = create_token("coche", "coche_iphone").unwrap();

        let exp_date = (Local::now() + week()).to_rfc3339();
        let inv_id = "XjKlQptXcAeQ";
        insert_mock_invitation_link("dario", inv_id, &exp_date, InvitationState::CREATED, &None);

        insert_mock_friends("dario", "coche");

        let rocket = rocket();
        let client = Client::new(rocket).expect("valid rocket instance");
        let mut request = client.post(format!("/v1/invitations/{}/accept", inv_id));
        request.add_header(Header::new(ASIMOV_LIVES, token));
        let mut response = request.dispatch();

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(
            r#"{"result":{"engineeringError":"db error: ERROR: duplicate key value violates unique constraint \"users_followers_pkey\"","message":"Service unavailable, please try again"},"success":false}"#,
            &response.body_string().unwrap()
        );
    }

    #[test]
    fn test_remove_friend() {
        dbmate_rebuild();
        insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
        let token = create_token("coche", "coche_iphone").unwrap();

        let exp_date = (Local::now() + week()).to_rfc3339();
        let inv_id = "XjKlQptXcAeQ";
        insert_mock_invitation_link(
            "dario",
            inv_id,
            &format!("{}", exp_date),
            InvitationState::CREATED,
            &None,
        );

        let rocket = rocket();
        let client = Client::new(rocket).expect("valid rocket instance");
        let mut request = client.get(format!("/v1/invitations/{}/creator", inv_id));
        request.add_header(Header::new(ASIMOV_LIVES, token));
        let mut response = request.dispatch();

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(
            r#"{"success":true,"result":{"firstName":"Dario","lastName":"Lencina-Talarico"}}"#,
            &response.body_string().unwrap()
        );
    }

    #[test]
    fn test_remove_non_existing_friend() {
        dbmate_rebuild();
        insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
        let token = create_token("coche", "coche_iphone").unwrap();

        let rocket = rocket();
        let client = Client::new(rocket).expect("valid rocket instance");
        let mut request = client.delete("/v1/invitations/remove/dario");
        request.add_header(Header::new(ASIMOV_LIVES, token));
        let mut response = request.dispatch();

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(
            r#"{"result":{"engineeringError":null,"message":"You are not friends with this user"},"success":false}"#,
            &response.body_string().unwrap()
        );
    }

    #[test]
    fn test_get_inv_creator() {
        dbmate_rebuild();
        insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
        let token = create_token("coche", "coche_iphone").unwrap();

        let exp_date = (Local::now() + week()).to_rfc3339();
        let inv_id = "XjKlQptXcAeQ";
        insert_mock_invitation_link(
            "dario",
            inv_id,
            &format!("{}", exp_date),
            InvitationState::CREATED,
            &None,
        );

        let rocket = rocket();
        let client = Client::new(rocket).expect("valid rocket instance");
        let mut request = client.get(format!("/v1/invitations/{}/creator", inv_id));
        request.add_header(Header::new(ASIMOV_LIVES, token));
        let mut response = request.dispatch();

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(
            r#"{"success":true,"result":{"firstName":"Dario","lastName":"Lencina-Talarico"}}"#,
            &response.body_string().unwrap()
        );
    }

    #[test]
    fn test_get_non_existent_inv() {
        dbmate_rebuild();
        insert_mock_public_key("coche", MOCK_PUBLIC_KEY);
        let token = create_token("coche", "coche_iphone").unwrap();

        let inv_id = "AodWEfA";
        let rocket = rocket();
        let client = Client::new(rocket).expect("valid rocket instance");
        let mut request = client.get(format!("/v1/invitations/{}/creator", inv_id));
        request.add_header(Header::new(ASIMOV_LIVES, token));
        let mut response = request.dispatch();

        assert_eq!(response.status(), Status::Ok);
        assert_eq!(
            r#"{"result":{"engineeringError":null,"message":"There is no invitation with that id"},"success":false}"#,
            &response.body_string().unwrap()
        );
    }
}
