use jsonwebtoken::{dangerous_insecure_decode, decode, Algorithm, DecodingKey, Validation};
use rocket::http::Status;
/**
 * Copyright [2020] [Dario Alessandro Lencina Talarico]
 * Licensed under the Apache License, Version 2.0 (the "License");
 * y ou may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
use rocket::request::{FromRequest, Outcome};
use rocket::{request, Request, State};

use crate::constants::ASIMOV_LIVES;
use crate::controllers::telemetry::{get_public_key, get_user_details};
use crate::model::{
    auth::{AuthInfo, Claims},
    responses::{APIJsonResponse, Errors::APIError},
    Storage,
};

impl<'a, 'r> FromRequest<'a, 'r> for AuthInfo {
    type Error = APIJsonResponse;

    fn from_request(request: &'a Request<'r>) -> request::Outcome<AuthInfo, Self::Error> {
        let keys: Vec<_> = request.headers().get(ASIMOV_LIVES).collect();

        if keys.len() != 1 {
            error!("Error parsing token");
            return Outcome::Failure((
                Status::Forbidden,
                APIJsonResponse {
                    json: json!(APIError {
                        message: "No token, no data".to_string(),
                        engineeringError: None
                    }),
                    status: Status::Forbidden,
                },
            ));
        }

        let storage = request
            .guard::<State<Storage>>()
            .expect("no database connection");

        let pool = &storage.database;

        let public_key;

        let token = keys[0];

        let claims: Claims;

        match dangerous_insecure_decode(&token) {
            Ok(token_data) => {
                claims = token_data.claims;
            }
            Err(e) => {
                error!("Error parsing token {}", e);
                return Outcome::Failure((
                    Status::Forbidden,
                    APIJsonResponse {
                        json: json!(APIError {
                            message: "Error parsing token".to_string(),
                            engineeringError: None
                        }),
                        status: Status::Forbidden,
                    },
                ));
            }
        }

        match get_public_key(&claims.username.to_string(), &pool) {
            Ok(key) => {
                public_key = key;
            }
            Err(e) => {
                error!("Error retrieving key, username: {}", &claims.username);
                let json_error =
                    APIJsonResponse::api_error_with_internal_error(e, "en".to_string());
                return Outcome::Failure((Status::Forbidden, json_error));
            }
        }

        let decoded_key;
        let key_with_headers = format!(
            "-----BEGIN PUBLIC KEY-----\n{}-----END PUBLIC KEY-----",
            public_key
        );
        match DecodingKey::from_rsa_pem((&key_with_headers).as_ref()) {
            Ok(key) => {
                decoded_key = key;
            }
            Err(error) => {
                error!(
                    "Client sent an invalid key {} username: {}",
                    error, &claims.username
                );
                return Outcome::Failure((
                    Status::Forbidden,
                    APIJsonResponse {
                        json: json!(APIError {
                            message: "No token, no data".to_string(),
                            engineeringError: None
                        }),
                        status: Status::Forbidden,
                    },
                ));
            }
        }

        let token_message =
            decode::<Claims>(&token, &decoded_key, &Validation::new(Algorithm::RS512));

        return match token_message {
            Ok(token_data) => {
                let language =
                    get_user_details(&token_data.claims.username, &mut pool.get().unwrap())
                        .ok()
                        .flatten()
                        .map(|user_details| user_details.language)
                        .flatten()
                        .unwrap_or("en".to_string());
                Outcome::Success(AuthInfo {
                    key: token.to_string(),
                    username: token_data.claims.username,
                    deviceId: token_data.claims.deviceId,
                    language,
                })
            }
            _ => Outcome::Failure((
                Status::Forbidden,
                APIJsonResponse {
                    json: json!(APIError {
                        message: "No token, no data".to_string(),
                        engineeringError: None
                    }),
                    status: Status::Forbidden,
                },
            )),
        };
    }
}
