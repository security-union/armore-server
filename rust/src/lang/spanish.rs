use super::TranslationIds;
use std::collections::HashMap;

lazy_static! {
    pub static ref SPANISH: HashMap<TranslationIds, &'static str> = vec![
        (TranslationIds::BackendIssue, "El servicio no se encuentra disponible, intente nuevamente"),
        (TranslationIds::DeviceNotFound, "Dispositivo no encontrado"),
        (TranslationIds::DeviceNotUpdated, "El dispositivo no se pudo actualizar"),
        (TranslationIds::NoUserForKey, "No existe un usuario para esta llave"),
        (TranslationIds::InvitationsYouAreNotFriends, "Usted no es amig@ de este usuario"),
        (TranslationIds::InvitationsInvitationDoesNotExist, "La invitación seleccionada no existe"),
        (TranslationIds::InvitationsInvitationIsNoLongerValid, "La invitación ha expirado"),
        (TranslationIds::DatabaseError, "Error de base de datos, un ingeniero será asignado a este problema"),
        (TranslationIds::NannyNotificationAttention, "Atención"),
        (TranslationIds::NannyNotificationBody,
         "El teléfono de {} {} no está mandando su ubicación, por favor contáctel@"),
        (TranslationIds::NannyNotificationOfflinePhoneOwnerBody,
         "Tu teléfono no está mandando su ubicación, por favor, abre Armore para arreglar esto"),
        (TranslationIds::PushNotificationInvitationAcceptedTitle, "aceptó tu invitación"),
        (TranslationIds::PushNotificationInvitationAcceptedBody, "ahora es tu amig@"),
        (TranslationIds::UserAlreadyInNormal, "No se pudo parar la emergencia"),
        (TranslationIds::UserAlreadyInEmergency, "No se pudo reportar la emergencia"),
        (TranslationIds::EmergencyModePushNotificationBody, "está en una EMERGENCIA! Por favor CONFIRME que están bien!!"),
        (TranslationIds::NormalModePushNotificationBody, "ya no está en una emergencia."),
        (TranslationIds::PushNotificationActionView, "Ir a la app")
    ].into_iter().collect();
}
