use crate::controllers::emergency::{send_emergency_notifications, update_user_state};
use amiquip::Connection as RabbitConnection;

use super::middleware::{catchers::catchers, cors::options};

use crate::{
    db::{get_connection, get_pool},
    messaging::{get_rabbitmq_uri, unlock_channel},
    model::{
        auth::AuthInfo,
        emergency::{UpdateState, UserState},
        responses::{APIJsonResponse, APIResponse},
        APIResult, Message, Storage,
    },
};
use log::error;
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
            update_user_state(&mut conn, &auth_info.username, new_state).and_then(|_| {
                if let Err(err) = send_emergency_notifications(
                    &mut conn,
                    &channel,
                    &auth_info.username,
                    &new_state,
                ) {
                    error!(
                        "{}",
                        err.engineering_error.unwrap_or("Unknown Error".to_string())
                    );
                };
                Ok(Json(APIResponse {
                    success: true,
                    result: Some(Message { message: new_state }),
                }))
            })
        })
        .map_err(|err| APIJsonResponse::api_error_with_internal_error(err, auth_info.language))
}

pub fn rocket() -> Rocket {
    let database = get_pool();
    let rabbit_conn = RabbitConnection::insecure_open(&get_rabbitmq_uri())
        .expect("Error getting rabbitMq Connection");
    rocket::ignite()
        .mount("/v1/emergency", routes![update_state])
        .register(catchers())
        .attach(options())
        .manage(Storage {
            redis: None,
            database,
        })
        .manage(Arc::new(Mutex::new(rabbit_conn)))
}
