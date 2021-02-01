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
use std::env;
use postgres::{error::Error, IsolationLevel, NoTls, Transaction};
use r2d2::Pool;
use r2d2_postgres::PostgresConnectionManager;
use super::model::{PostgresConnection, PostgresPool, Storage};
use crate::model::responses::Errors::APIInternalError;
use rocket::State;

pub fn get_database_url() -> String {
    if let Ok(url) = env::var("PG_URL") {
        url
    } else {
        let db_user = env::var("PG_USER").expect("PG_USER must be set");
        let db_pass = env::var("PG_PASS").expect("PG_PASS must be set");
        let db_host = env::var("PG_HOST").expect("PG_HOST must be set");
        let db_port = env::var("PG_PORT").expect("PG_PORT must be set");
        let db_name = env::var("PG_DB").expect("PG_DB must be set");

        format!(
            "user={} password={} host={} port={} dbname={}",
            db_user, db_pass, db_host, db_port, db_name
        )
    }
}

pub fn get_pool() -> PostgresPool {
    let manager = PostgresConnectionManager::new(
        get_database_url()
            .parse()
            .expect("Database url is in a bad format."),
        NoTls,
    );
    Pool::builder()
        .max_size(5)
        .build(manager)
        .expect("Failed to build a database connection pool")
}

/// Try to get a connection from the r2d2 Postgres Pool
/// If it fails return an API Result
/// This function is intended to be used to return the results of an API Call
pub fn get_connection(state: State<Storage>) -> Result<PostgresConnection, APIInternalError> {
    state.database.get().map_err(APIInternalError::backend_issue)
}

pub fn transaction<F, T>(conn: &mut PostgresConnection, action: F) -> Result<T, Error>
where
    F: FnOnce(&mut Transaction) -> Result<T, Error>,
{
    conn.build_transaction()
        .isolation_level(IsolationLevel::Serializable)
        .start()
        .and_then(|mut transaction| {
            action(&mut transaction).and_then(|res| transaction.commit().map(|_| res))
        })
}
