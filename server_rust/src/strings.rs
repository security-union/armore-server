use crate::strings;
use std::collections::HashMap;

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
}

lazy_static! {
    pub static ref SPANISH: HashMap<TranslationIds, &'static str> = vec![
        (strings::TranslationIds::BackendIssue, "El servicio no se encuentra disponible, intente nuevamente"),
        (strings::TranslationIds::DeviceNotFound, "Dispositivo no encontrado"),
        (strings::TranslationIds::DeviceNotUpdated, "El dispositivo no se pudo actualizar"),
        (strings::TranslationIds::NoUserForKey, "No existe un usuario para esta llave"),
        (strings::TranslationIds::InvitationsYouAreNotFriends, "Usted no es amig@ de este usuario"),
        (strings::TranslationIds::InvitationsInvitationDoesNotExist, "La invitación seleccionada no existe"),
        (strings::TranslationIds::InvitationsInvitationIsNoLongerValid, "La invitación ha expirado"),
        (strings::TranslationIds::DatabaseError, "Error de base de datos, un ingeniero será asignado a este problema"),
        (strings::TranslationIds::NannyNotificationAttention, "Atención"),
        (strings::TranslationIds::NannyNotificationBody,
         "El teléfono de {} {} no está mandando su ubicación, por favor contáctel@"),
        (strings::TranslationIds::NannyNotificationOfflinePhoneOwnerBody,
         "Tu teléfono no está mandando su ubicación, por favor, abre Armore para arreglar esto"),
        (strings::TranslationIds::PushNotificationInvitationAcceptedTitle, "aceptó tu invitación"),
        (strings::TranslationIds::PushNotificationInvitationAcceptedBody, "ahora es tu amig@")
    ].into_iter().collect();

    pub static ref ENGLISH:  HashMap<TranslationIds, &'static str> = vec![
        (strings::TranslationIds::NoUserForKey, "No user for key"),
        (strings::TranslationIds::DeviceNotFound, "Device not found"),
        (strings::TranslationIds::DeviceNotUpdated, "Device not updated"),
        (strings::TranslationIds::BackendIssue, "Service unavailable, please try again"),
        (strings::TranslationIds::InvitationsYouAreNotFriends, "You are not friends with this user"),
        (strings::TranslationIds::InvitationsInvitationDoesNotExist, "There is no invitation with that id"),
        (strings::TranslationIds::InvitationsInvitationIsNoLongerValid, "The invitation is no longer valid"),
        (strings::TranslationIds::DatabaseError, "Database error, an engineer will be assigned to this issue"),
        (strings::TranslationIds::NannyNotificationAttention, "Attention"),
        (strings::TranslationIds::NannyNotificationBody,
         "{} {}'s phone is not sending it's location, please contact this person to make sure that is ok"),
        (strings::TranslationIds::NannyNotificationOfflinePhoneOwnerBody,
         "Your phone is not sending it's location, please open Armore to fix this"),
        (strings::TranslationIds::PushNotificationInvitationAcceptedTitle, "accepted your invitation"),
        (strings::TranslationIds::PushNotificationInvitationAcceptedBody, "is now friends with you")
    ].into_iter().collect();
}

pub fn get_dictionary(language: String) -> &'static HashMap<TranslationIds, &'static str> {
    match language.as_str() {
        "es" => (&strings::SPANISH as &HashMap<TranslationIds, &'static str>),
        _ => (&strings::ENGLISH as &HashMap<TranslationIds, &'static str>),
    }
}
