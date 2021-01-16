import { Trans } from "./translation";

const spanish: Record<Trans, string> = {
    [Trans.InternalServerError]:
        "Error interno, un ingeniero ha sido informado de esta situación y resolveremos esto.",
    [Trans.InvalidCredentials]: "Credenciales incorrectas",
    [Trans.Success]: "Exito",
    [Trans.DeviceIsRegisteredToAnotherUser]: "Este teléfono está registrado a otro usuario",
    [Trans.UnableToCreateDevice]: "No fue posible registrar el dispositivo",
    [Trans.PasswordResetMessage]:
        "Si encontramos su cuenta, le mandaremos un correo electrónico con instrucciones.",
    [Trans.PasswordResetSuccess]: "Su password ha sido actualizado correctamente.",
    [Trans.RegistrationSuccess]: "Su registro fue exitoso",
    [Trans.PasswordsNotEqual]: "Los passwords no son iguales",
    [Trans.EmailsAreNotEqual]: "Los emails no son iguales",
    [Trans.InvalidFirstName]: "El nombre es muy corto",
    [Trans.InvalidLastName]: "El apellido es muy corto",
    [Trans.InvalidPhoneNumber]: "Número de teléfono inválido",
    [Trans.PasswordResetExpired]: "El link ha expirado, cree otro reseteo de password desde la app",
    [Trans.InvitationCreatedSuccessfully]: "Invitación enviada exitosamente",
    [Trans.InvitationErrorNoPhoneOrEmail]:
        "Debe especificar un número de teléfono o correo electrónico.",
    [Trans.Ok]: "Ok",
    [Trans.BadRequest]: "El teléfono mandó un request mal formado",
    [Trans.SenderEmailMustNotBeEqualToReceiver]:
        "El correo de la persona que desea invitar debe de ser diferente al suyo",
    [Trans.UserAlreadySentAnInvitation]: "Usted ya envió una invitación a esta persona",
    [Trans.ThisUserAlreadyFollowsYou]: "El usuario seleccionado ya te sigue.",
    [Trans.UnableToFindInvitation]: "Unable to find invitation",
    [Trans.UnableToCreateGeofence]: "No se pudo crear la geonfensa",
    [Trans.UnableToSubscribeToGeofence]: "No se puede suscribir a la geofensa",
    [Trans.SubscribedToGeofence]: "Ahora usted está subscrito a esta geofensa",
    [Trans.TryAnotherEmailOrUsername]:
        "El nombre de usuario o el email que seleccionó no están disponibles.",
    [Trans.TryAnotherEmail]: "El email seleccionado no está disponible.",
    [Trans.TryAnotherPhone]: "El número de teléfono seleccionado no está disponible.",
    [Trans.TryAnotherPhoneOrUsername]:
        "El nombre de usuario o el número de teléfono que seleccionó no está disponible.",
    [Trans.TryAnotherUsername]: "El usuario seleccionado no está disponible",
    [Trans.ValidationWithValue]: "con valor",
    [Trans.ValidationIsInvalid]: "es inválido",
    [Trans.EmergencyModePushNotificationBody]:
        "¡AYUDA! %s está en una emergencia. Por favor confirme que están bien.",
    [Trans.NormalModePushNotificationBody]: "%s ya no está en una emergencia.",
    [Trans.UserIsNotInAnEmergency]:
        "%s no está en una emergencia, su ubicación histórica está desactivada.",
    [Trans.UserIsNotBeingFollowed]: "El usuario %s no es seguidor de %s",
    [Trans.ThereIsAnotherDeviceRegistered]: `Hay otro dispositivo registrado en su cuenta, para poder entrar, debe de removerlo.`,
    [Trans.DeleteDeviceSuccess]: "Listo, el dispositivo fue eliminado",
    [Trans.MaxFollowersError]:
        "Ha alcanzado el número máximo de seguidores, para agregar a alguien más debe de borrar un seguidor",
    [Trans.PushNotificationActionView]: "Ir a la App",
    [Trans.PushNotificationInvitationAcceptedTitle]: "%s aceptó tu invitación",
    [Trans.PushNotificationInvitationAcceptedBody]: "%s ahora te sigue",
    [Trans.PushNotificationInvitationCreatedTitle]: "%s te mandó una invitación",
    [Trans.PushNotificationInvitationCreatedBody]: "%s quiere que l@ sigas",
    [Trans.SmsInvitationCreatedBody]:
        "%s quiere que le sigas en la app Armore. Armore es la mejor app para localizar a tus seres queridos usando cifrado de extremo a extremo. %s",
    [Trans.SmsInvitationCreatedBodyNewUser]: "Android: %s\n\niOS: %s",
    [Trans.VerificationEmailBody]:
        "Hola %s, haga clic en el enlace a continuación o use el código para verificar que usted es el propietario de esta cuenta.",
    [Trans.VerificationEmailTitle]: "Se requiere verificación por correo electrónico",
    [Trans.VerificationEmailButtonText]: "Verificar",
    [Trans.VerificationSuccess]: "Su cuenta ha sido verificada con éxito!",
    [Trans.VerificationFailure]:
        "No se pudo verificar la cuenta, por favor, envíe un código nuevo.",
    [Trans.VerificationCreatedSuccessfully]: "Solicitud de verificación exitosa",
    [Trans.SmsVerificationBody]: "Su código de verificación de Armore es: %s\n%s",
};

export default spanish;
