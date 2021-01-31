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

pub mod auth;
pub mod devices;
pub mod emergency;
pub mod invitations;
pub mod notifications;
pub mod requests;
pub mod responses;
pub mod telemetry;

use postgres::NoTls;
use r2d2::Pool;
use r2d2::PooledConnection;
use r2d2_postgres::PostgresConnectionManager;
use rocket_contrib::json::Json;
use serde::{Deserialize, Serialize};
use responses::{APIJsonResponse, APIResponse};

pub type APIResult<T> = Result<Json<APIResponse<Option<T>>>, APIJsonResponse>;
pub type PostgresPool = Pool<PostgresConnectionManager<NoTls>>;
pub type PostgresConnection = PooledConnection<PostgresConnectionManager<NoTls>>;

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserDetails {
    pub username: String,
    pub firstName: String,
    pub lastName: String,
    pub email: Option<String>,
    pub phoneNumber: Option<String>,
    pub picture: Option<String>,
    #[serde(skip_serializing)]
    pub language: Option<String>,
}

impl UserDetails {
    pub fn from_complete_details(row: &postgres::Row) -> Self {
        UserDetails {
            username: row.get("username"),
            firstName: row.get("first_name"),
            lastName: row.get("last_name"),
            email: row.get("email"),
            phoneNumber: row.get("phone_number"),
            picture: row.get("picture"),
            language: row.get("language"),
        }
    }
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone)]
pub struct Message<T>
where
    T: Serialize,
{
    pub message: T,
}

#[derive(Debug)]
pub struct Storage {
    pub redis: Option<redis::Client>,
    pub database: Pool<PostgresConnectionManager<NoTls>>,
}

#[cfg(test)]
mod test {
    use chrono::{DateTime, Datelike, Timelike};

    #[test]
    fn test_date_parser() {
        let exp_date = "2018-02-04T04:03:46.597Z";
        let result = DateTime::parse_from_rfc3339(exp_date).unwrap();
        assert_eq!(result.date().year(), 2018);
        assert_eq!(result.date().month(), 2);
        assert_eq!(result.date().day(), 4);
        assert_eq!(result.time().hour(), 4);
        assert_eq!(result.time().minute(), 03);
        assert_eq!(result.time().second(), 46);
    }
}
