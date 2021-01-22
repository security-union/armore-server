use std::env;

use amiquip::Connection;
use rocket::{Rocket, State};
use rocket_contrib::json::Json;

use super::middleware::{catchers::catchers, cors::self};
use crate::controllers::devices::{get_device_by_id, update_device_settings};
use crate::db::get_pool;
use crate::controllers::telemetry::{
    close_command, force_refresh_telemetry_internal, get_connections, get_follower_keys,
    get_user_state, store_telemetry, username_has_follower,
};
use crate::model::{
    responses::{APIJsonResponse, APIResponse, TelemetryResponse, CommandResponse, DeviceUpdateResponse},
    telemetry::{CommandState, FollowerKey},
    emergency::AccessType,
    emergency::UserState,
    auth::AuthInfo,
    requests::{DeviceUpdateRequest, TelemetryRequest},
    Storage,
};
use crate::messaging::{get_rabbitmq_uri, send_ws_message};

#[allow(unused_must_use)]
#[post(
    "/telemetry",
    format = "application/json",
    data = "<telemetry_request>"
)]
fn post_telemetry(
    state: State<Storage>,
    auth_info: AuthInfo,
    telemetry_request: Json<TelemetryRequest>,
) -> Result<Json<APIResponse<Option<TelemetryResponse>>>, APIJsonResponse> {
    let mut client = state
        .database
        .get()
        .expect("Unable to get database connection from state.");
    let mut redis = state
        .redis
        .clone()
        .expect("Unable to clone redis from state.")
        .get_connection()
        .expect("Unable to get redis connection from state.");

    store_telemetry(&telemetry_request, &auth_info, &mut client, &mut redis).map_err(|err| {
        APIJsonResponse::api_error_with_internal_error(err, auth_info.language.to_string())
    })?;

    // This request was force pushed due to a ForcePush Request, store the result.
    if telemetry_request.correlationId.is_some() {
        let error = close_command(
            &mut client,
            &CommandState::Completed,
            &telemetry_request.correlationId.as_ref().unwrap(),
        )
        .err();
        if error.is_some() {
            error!("error closing the command {}", error.unwrap())
        }
    }

    // TODO: send message to geofence service.
    let all_friends =
        get_connections(&auth_info.username, &mut client, &mut redis).map_err(|err| {
            APIJsonResponse::api_error_with_internal_error(err, auth_info.language.to_string())
        })?;

    let user_state = get_user_state(&auth_info.username, &mut client).map_err(|err| {
        APIJsonResponse::api_error_with_internal_error(err, auth_info.language.to_string())
    })?;

    match (user_state, Connection::insecure_open(&get_rabbitmq_uri())) {
        (Some(state), Ok(mut connection)) => {
            for telemetry in &telemetry_request.telemetry {
                let follower = all_friends.followers.get(&telemetry.recipientUsername);
                if follower.is_some() {
                    let access_type = follower.unwrap().accessType.unwrap();
                    if access_type == AccessType::Permanent || state == UserState::Emergency {
                        send_ws_message(&mut connection, telemetry, &auth_info.username);
                    }
                }
            }
            connection.close();
        }
        _ => {
            error!("Unable to send rabbitMqMessage");
        }
    }

    if telemetry_request.returnFriendLocations {
        Ok(Json(APIResponse {
            success: true,
            result: Option::Some(all_friends),
        }))
    } else {
        Ok(Json(APIResponse {
            success: true,
            result: Option::None,
        }))
    }
}

#[allow(unused_must_use)]
#[get("/followers/keys", format = "application/json")]
fn get_keys(
    state: State<Storage>,
    auth_info: AuthInfo,
) -> Result<Json<APIResponse<Vec<FollowerKey>>>, APIJsonResponse> {
    let mut client = state
        .database
        .get()
        .expect("Unable to get database connection from state.");
    let keys = get_follower_keys(&auth_info.username, &mut client)
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, auth_info.language))?;
    Ok(Json(APIResponse {
        success: true,
        result: keys,
    }))
}

#[allow(unused_must_use)]
#[get("/telemetry/<recipient_username>", format = "application/json")]
fn force_refresh_telemetry(
    recipient_username: String,
    state: State<Storage>,
    auth_info: AuthInfo,
) -> Result<Json<APIResponse<CommandResponse>>, APIJsonResponse> {
    let mut client = state
        .database
        .get()
        .expect("Unable to get database connection from state.");

    // 0. Verify that username follows recipient_username
    let username_has_follower =
        username_has_follower(&mut client, &recipient_username, &auth_info.username).map_err(
            |err| {
                APIJsonResponse::api_error_with_internal_error(err, auth_info.language.to_string())
            },
        )?;
    if !username_has_follower {
        return Ok(Json(APIResponse {
            success: false,
            result: CommandResponse {
                correlation_id: Option::None,
                commandStatus: CommandState::Error,
                error: Option::Some("security".to_string()),
            },
        }));
    }

    force_refresh_telemetry_internal(&mut client, recipient_username, &auth_info).map_err(|err| {
        APIJsonResponse::api_error_with_internal_error(err, auth_info.language.to_string())
    })
}

#[allow(unused_must_use)]
#[post(
    "/device/settings",
    data = "<device_update_request>",
    format = "application/json"
)]
fn update_device(
    device_update_request: Json<DeviceUpdateRequest>,
    state: State<Storage>,
    auth_info: AuthInfo,
) -> Result<Json<APIResponse<DeviceUpdateResponse>>, APIJsonResponse> {
    let mut client = state
        .database
        .get()
        .expect("Unable to get database connection from state.");

    let mut device_update =
        get_device_by_id(&auth_info.deviceId[..], &mut client).map_err(|error| {
            APIJsonResponse::api_error_with_internal_error(error, (&auth_info.language).to_string())
        })?;

    device_update.locationPermissionState = device_update_request.0.locationPermissionState;
    device_update.isBackgroundRefreshOn = device_update_request.0.isBackgroundRefreshOn;
    device_update.isLocationServicesOn = device_update_request.0.isLocationServicesOn;
    device_update.isNotificationsEnabled = device_update_request.0.isNotificationsEnabled;
    device_update.isPowerSaveModeOn = device_update_request.0.isPowerSaveModeOn;
    device_update.osVersion = device_update_request.0.osVersion.clone();
    device_update.appVersion = device_update_request.0.appVersion.clone();

    update_device_settings(device_update, &mut client)
        .and_then(|u| {
            Ok(Json(APIResponse {
                success: true,
                result: DeviceUpdateResponse { updated: u },
            }))
        })
        .map_err(|error| APIJsonResponse::api_error_with_internal_error(error, auth_info.language))
}

pub fn rocket() -> Rocket {
    let database = get_pool();
    let redis = redis::Client::open(env::var("REDIS_URL").expect("REDIS_URL must be set"))
        .expect("Failed to open redis client.");
    let storage = Storage {
        redis: Some(redis),
        database,
    };

    rocket::ignite()
        .mount(
            "/v1",
            routes![
                post_telemetry,
                get_keys,
                force_refresh_telemetry,
                update_device
            ],
        )
        .register(catchers())
        .attach(cors::options())
        .manage(storage)
}
