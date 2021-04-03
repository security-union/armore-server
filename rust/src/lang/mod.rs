mod english;
mod spanish;

use english::ENGLISH;
use serde::Serialize;
use spanish::SPANISH;
use std::collections::HashMap;

#[derive(Debug, Serialize, PartialEq, Eq, Hash)]
pub enum TranslationIds {
    NannyNotificationAttention,
    NannyNotificationBody,
    NannyNotificationOfflinePhoneOwnerBody,
    BackendIssue,
    DatabaseError,
    InvitationsYouAreNotFriends,
    InvitationsInvitationDoesNotExist,
    InvitationsInvitationIsNoLongerValid,
    DeviceNotFound,
    NoUserForKey,
    DeviceNotUpdated,
    PushNotificationInvitationAcceptedTitle,
    PushNotificationInvitationAcceptedBody,
    UserAlreadyInEmergency,
    UserAlreadyInNormal,
    UserNotInEmergency,
    NormalModePushNotificationBody,
    EmergencyModePushNotificationBody,
    PushNotificationActionView,
    InvalidHistoricalLocationStartTime,
    CannotUseOwnInvitation,
    InvitationsAlreadyFriends,
}

pub fn get_glossary(language: &str) -> &'static HashMap<TranslationIds, &'static str> {
    match language {
        "es" => (&SPANISH as &HashMap<TranslationIds, &'static str>),
        _ => (&ENGLISH as &HashMap<TranslationIds, &'static str>),
    }
}
