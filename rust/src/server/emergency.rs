use super::middleware::{catchers::catchers, cors::options};
use super::validators::friends::assert_not_friends;
use crate::{
    controllers::emergency::{get_historical_location, update_user_state},
    db::{get_connection, get_pool},
    messaging::{get_rabbitmq_uri, unlock_channel},
    model::{
        auth::AuthInfo,
        emergency::{UpdateState, UserState},
        responses::{APIJsonResponse, APIResponse},
        telemetry::{DateTimeRange, Location},
        APIResult, Message, Storage,
    },
};
use amiquip::Connection as RabbitConnection;
use rocket::{Rocket, State};
use rocket_contrib::json::Json;
use std::sync::{Arc, Mutex};

#[post("/state", format = "application/json", data = "<update_state>")]
fn update_state(
    auth_info: AuthInfo,
    update_state: Json<UpdateState>,
    storage: State<Storage>,
    rabbit: State<Arc<Mutex<RabbitConnection>>>,
) -> APIResult<Message<UserState>> {
    let new_state = update_state.new_state;
    get_connection(storage)
        .and_then(|conn| unlock_channel(rabbit).map(|channel| (conn, channel)))
        .and_then(|(mut conn, channel)| {
            update_user_state(&mut conn, &channel, &auth_info.username, &new_state)
        })
        .and_then(|_| {
            Ok(Json(APIResponse {
                success: true,
                result: Some(Message { message: new_state }),
            }))
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, &auth_info.language))
}

#[post("/<username>/emergency")]
fn report_friend_emergency(
    auth_info: AuthInfo,
    username: String,
    storage: State<Storage>,
    rabbit: State<Arc<Mutex<RabbitConnection>>>,
) -> APIResult<Message<UserState>> {
    get_connection(storage)
        .and_then(|conn| unlock_channel(rabbit).map(|channel| (conn, channel)))
        .and_then(|(mut conn, channel)| {
            assert_not_friends(&mut conn, &auth_info.username, &username).and_then(|_| {
                update_user_state(&mut conn, &channel, &username, &UserState::Emergency)
            })
        })
        .and_then(|_| {
            Ok(Json(APIResponse {
                success: true,
                result: Some(Message {
                    message: UserState::Emergency,
                }),
            }))
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, &auth_info.language))
}

#[get("/<username>/telemetry?<start_time>&<end_time>")]
fn get_user_historical_location(
    username: String,
    start_time: String,
    end_time: String,
    auth_info: AuthInfo,
    storage: State<Storage>,
) -> APIResult<Vec<Location>> {
    let date_range = DateTimeRange::from_str(&start_time, &end_time)
        .map_err(|err| APIJsonResponse::api_error(err, None))?;
    get_connection(storage)
        .and_then(|mut conn| get_historical_location(&mut conn, &auth_info, &username, &date_range))
        .and_then(|historical| {
            Ok(Json(APIResponse {
                success: true,
                result: Some(historical),
            }))
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, &auth_info.language))
}

pub fn rocket() -> Rocket {
    let database = get_pool();
    let rabbit_conn = RabbitConnection::insecure_open(&get_rabbitmq_uri())
        .expect("Error getting rabbitMq Connection");
    rocket::ignite()
        .mount(
            "/v1/emergency",
            routes![update_state, get_user_historical_location],
        )
        .register(catchers())
        .attach(options())
        .manage(Storage {
            redis: None,
            database,
        })
        .manage(Arc::new(Mutex::new(rabbit_conn)))
}
