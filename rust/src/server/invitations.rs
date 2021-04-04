use super::middleware::{catchers::catchers, cors::options};
use super::validators::{friends::assert_not_friends, invitations::assert_valid_invitation};
use crate::controllers::invitations::{
    accept_invitation, create_invitation, get_invitation_creator, notify_accepted,
    reject_invitation, remove_friends,
};
use crate::controllers::telemetry::force_refresh_telemetry_internal;
use crate::utils::sentry::log_api_err;
use crate::{
    db::{get_connection, get_pool},
    model::{
        auth::AuthInfo,
        invitations::{LinkActionData, LinkCreationData},
        requests::InvitationRequest,
        responses::{
            APIJsonResponse, APIResponse, AcceptInvitationResponse, CreateInvitationResponse,
        },
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
) -> APIResult<CreateInvitationResponse> {
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
                result: Some(CreateInvitationResponse { link }),
            }))
        })
        .map_err(|err| {
            log_api_err("POST /v1/invitations", &err, Some(&auth_info));
            APIJsonResponse::api_error_with_internal_error(err, &auth_info.language)
        })
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
        .map_err(|err| {
            log_api_err(
                &format!("POST /v1/invitations/{}/reject", id),
                &err,
                Some(&auth_info),
            );
            APIJsonResponse::api_error_with_internal_error(err, &auth_info.language)
        })
}

#[post("/<id>/accept")]
fn accept(
    id: String,
    auth_info: AuthInfo,
    state: State<Storage>,
) -> APIResult<AcceptInvitationResponse> {
    let data = LinkActionData {
        uuid: id.clone(),
        username: auth_info.username.clone(),
    };

    get_connection(state)
        .and_then(|mut conn| {
            assert_valid_invitation(&mut conn, &data)?;
            let res = accept_invitation(&mut conn, &data)?;

            let _ = notify_accepted(&mut conn, &data)
                .map_err(|w| w.log_err("Error sending notification"));

            let inv_creator_data = get_invitation_creator(&mut conn, &id)?;
            let creator_username: String = inv_creator_data["username"].as_str().unwrap().into();

            let error = force_refresh_telemetry_internal(
                &mut conn,
                auth_info.username.clone(),
                creator_username,
            );

            let _ = error.map_err(|w| w.log_err("push refresh error"));

            Ok(Json(APIResponse {
                success: true,
                result: Some(res),
            }))
        })
        .map_err(|err| {
            log_api_err(
                &format!("POST /v1/invitations/{}/accept", id),
                &err,
                Some(&auth_info),
            );
            APIJsonResponse::api_error_with_internal_error(err, &auth_info.language)
        })
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
        .map_err(|err| {
            log_api_err(
                &format!("DELETE /v1/invitations/remove/{}", username),
                &err,
                Some(&auth_info),
            );
            APIJsonResponse::api_error_with_internal_error(err, &auth_info.language)
        })
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
        .map_err(|err| {
            log_api_err(
                &format!("GET /v1/invitations/{}/creator", id),
                &err,
                Some(&auth_info),
            );
            APIJsonResponse::api_error_with_internal_error(err, &auth_info.language)
        })
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
        .map_err(|err| {
            log_api_err(
                &format!("GET /v1/invitations/public/{}/creator", id),
                &err,
                None,
            );
            APIJsonResponse::api_error_with_internal_error(err, &"en".to_string())
        })
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
