use std::collections::HashMap;
mod english;
mod spanish;

use english::ENGLISH;
use spanish::SPANISH;

#[derive(Debug, PartialEq, Eq, Hash)]
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
    NormalModePushNotificationBody,
    EmergencyModePushNotificationBody,
    PushNotificationActionView
}


pub fn get_dictionary(language: String) -> &'static HashMap<TranslationIds, &'static str> {
    match language.as_str() {
        "es" => (&SPANISH as &HashMap<TranslationIds, &'static str>),
        _ => (&ENGLISH as &HashMap<TranslationIds, &'static str>),
    }
}
