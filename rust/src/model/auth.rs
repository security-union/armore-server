use serde::{Deserialize, Serialize};

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub username: String,
    pub deviceId: String,
    pub exp: i64,
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AuthInfo {
    pub key: String,
    pub username: String,
    pub deviceId: String,
    pub language: String,
}
