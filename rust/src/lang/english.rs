use super::TranslationIds;
use std::collections::HashMap;

lazy_static! {
    pub static ref ENGLISH:  HashMap<TranslationIds, &'static str> = vec![
        (TranslationIds::NoUserForKey, "No user for key"),
        (TranslationIds::DeviceNotFound, "Device not found"),
        (TranslationIds::DeviceNotUpdated, "Device not updated"),
        (TranslationIds::BackendIssue, "Service unavailable, please try again"),
        (TranslationIds::InvitationsYouAreNotFriends, "You are not friends with this user"),
        (TranslationIds::InvitationsInvitationDoesNotExist, "There is no invitation with that id"),
        (TranslationIds::InvitationsInvitationIsNoLongerValid, "The invitation is no longer valid"),
        (TranslationIds::DatabaseError, "Database error, an engineer will be assigned to this issue"),
        (TranslationIds::NannyNotificationAttention, "Attention"),
        (TranslationIds::NannyNotificationBody,
         "{} {}'s phone is not sending it's location, please contact this person to make sure that is ok"),
        (TranslationIds::NannyNotificationOfflinePhoneOwnerBody,
         "Your phone is not sending it's location, please open Armore to fix this"),
        (TranslationIds::PushNotificationInvitationAcceptedTitle, "accepted your invitation"),
        (TranslationIds::PushNotificationInvitationAcceptedBody, "is now friends with you"),
        (TranslationIds::UserAlreadyInNormal, "Cannot end the emergency"),
        (TranslationIds::UserAlreadyInEmergency, "Cannot report the emergency"),
        (TranslationIds::UserNotInEmergency, "This user is not in an emergency"),
        (TranslationIds::EmergencyModePushNotificationBody, "is in an EMERGENCY! Please CONFIRM that they are okay!!"),
        (TranslationIds::NormalModePushNotificationBody, "is no longer in an emergency."),
        (TranslationIds::PushNotificationActionView, "Go to app")
    ].into_iter().collect();
}
