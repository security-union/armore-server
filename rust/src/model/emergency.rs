use postgres_types::{FromSql, ToSql};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateState {
    pub new_state: UserState,
}

#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
#[postgres(name = "accesstype")]
pub enum AccessType {
    Permanent,
    EmergencyOnly,
}

#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
#[postgres(name = "userstate")]
pub enum UserState {
    Normal,
    Emergency,
}
