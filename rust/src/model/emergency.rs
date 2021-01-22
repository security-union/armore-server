use postgres_types::{FromSql, ToSql};
use serde::{Deserialize, Serialize};


#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateState {
    pub new_state: UserState,
}

#[postgres(name = "accesstype")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum AccessType {
    Permanent,
    EmergencyOnly,
}

#[postgres(name = "userstate")]
#[derive(Serialize, Deserialize, Clone, Debug, ToSql, FromSql, PartialEq, Eq, Copy)]
pub enum UserState {
    Normal,
    Emergency,
}
