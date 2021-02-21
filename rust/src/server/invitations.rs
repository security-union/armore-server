use super::middleware::{catchers::catchers, cors::options};
use super::validators::{friends::assert_not_friends, invitations::assert_valid_invitation};
use crate::controllers::invitations::{
    accept_invitation, create_invitation, get_invitation_creator, notify_accepted,
    reject_invitation, remove_friends,
};
use crate::{
    db::{get_connection, get_pool},
    model::{
        auth::AuthInfo,
        invitations::{LinkActionData, LinkCreationData},
        requests::InvitationRequest,
        responses::{APIJsonResponse, APIResponse, InvitationResponse},
        APIResult, Message, Storage,
    },
};
use rocket::{Rocket, State};
use rocket_contrib::json::{Json, JsonValue};
use uuid::Uuid;

/// Create a new invitation link from post request
/// Requires client AuthInfo and the expiration date
/// Returns the generated link for this invitation
#[post("/", format = "application/json", data = "<invitation_req>")]
fn create(
    invitation_req: Json<InvitationRequest>,
    auth_info: AuthInfo,
    state: State<Storage>,
) -> APIResult<InvitationResponse> {
    // Get the basic data to create a new invitation_link instance
    let data = LinkCreationData::new(
        Uuid::new_v4().to_string(),
        auth_info.username.clone(),
        invitation_req.expirationDate.clone(),
    )?;
    get_connection(state)
        .and_then(|conn| {
            let link = create_invitation(conn, data)?;
            Ok(Json(APIResponse {
                success: true,
                result: Some(InvitationResponse { link }),
            }))
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, &auth_info.language))
}

#[post("/<id>/reject")]
fn reject(id: String, auth_info: AuthInfo, state: State<Storage>) -> APIResult<Message<String>> {
    let data = LinkActionData {
        uuid: id.clone(),
        username: auth_info.username.clone(),
    };

    get_connection(state)
        .and_then(|mut conn| {
            assert_valid_invitation(&mut conn, &data)?;
            reject_invitation(conn, data)?;
            Ok(Json(APIResponse {
                success: true,
                result: Some(Message {
                    message: "Ok".to_string(),
                }),
            }))
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, &auth_info.language))
}

#[post("/<id>/accept")]
fn accept(id: String, auth_info: AuthInfo, state: State<Storage>) -> APIResult<Message<String>> {
    let data = LinkActionData {
        uuid: id.clone(),
        username: auth_info.username.clone(),
    };

    get_connection(state)
        .and_then(|mut conn| {
            assert_valid_invitation(&mut conn, &data)?;
            accept_invitation(&mut conn, &data)?;

            let _ = notify_accepted(&mut conn, &data)
                .map_err(|w| w.log_err("Error sending notification"));

            Ok(Json(APIResponse {
                success: true,
                result: Some(Message {
                    message: "Ok".to_string(),
                }),
            }))
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, &auth_info.language))
}

#[delete("/remove/<username>")]
fn remove_friend(
    username: String,
    auth_info: AuthInfo,
    state: State<Storage>,
) -> APIResult<Message<String>> {
    get_connection(state)
        .and_then(|mut conn| {
            assert_not_friends(&mut conn, &auth_info.username, &username)?;
            remove_friends(conn, &auth_info.username, &username)?;
            Ok(Json(APIResponse {
                success: true,
                result: Some(Message {
                    message: "Ok".to_string(),
                }),
            }))
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, &auth_info.language))
}

#[get("/<id>/creator")]
pub fn get_creator(id: String, auth_info: AuthInfo, state: State<Storage>) -> APIResult<JsonValue> {
    get_connection(state)
        .and_then(|mut conn| {
            let data = get_invitation_creator(&mut conn, &id)?;
            Ok(Json(APIResponse {
                success: true,
                result: Some(data),
            }))
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, &auth_info.language))
}

#[get("/public/<id>/creator")]
pub fn get_creator_public(id: String, state: State<Storage>) -> APIResult<JsonValue> {
    get_connection(state)
        .and_then(|mut conn| {
            let data = get_invitation_creator(&mut conn, &id)?;
            Ok(Json(APIResponse {
                success: true,
                result: Some(data),
            }))
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, &"en".to_string()))
}

pub fn rocket() -> Rocket {
    let database = get_pool();
    rocket::ignite()
        .mount(
            "/v1/invitations",
            routes![
                create,
                accept,
                reject,
                remove_friend,
                get_creator,
                get_creator_public
            ],
        )
        .register(catchers())
        .attach(options())
        .manage(Storage {
            redis: None,
            database,
        })
}
