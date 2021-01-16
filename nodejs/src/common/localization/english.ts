import { Trans } from "./translation";

const english: Record<Trans, string> = {
    [Trans.InternalServerError]:
        "Internal server error. An engineer has been notified and we will solve this asap.",
    [Trans.InvalidCredentials]: "Invalid credentials",
    [Trans.Success]: "Success",
    [Trans.DeviceIsRegisteredToAnotherUser]: "Device is already registered for a different user.",
    [Trans.UnableToCreateDevice]: "Unable to register device",
    [Trans.PasswordResetMessage]:
        "If we find an account for the username or email provided, you will receive an email.",
    [Trans.PasswordResetSuccess]: "Your password has been reset successfully!",
    [Trans.RegistrationSuccess]: "Registration successful",
    [Trans.PasswordsNotEqual]: "Passwords are not equal",
    [Trans.EmailsAreNotEqual]: "Emails are not equal",
    [Trans.InvalidFirstName]: "Invalid First Name",
    [Trans.InvalidLastName]: "Invalid Last Name",
    [Trans.InvalidPhoneNumber]: "Invalid Phone Number",
    [Trans.PasswordResetExpired]:
        "The password link has expired, please create another password reset from the app",
    [Trans.InvitationCreatedSuccessfully]: "Invitation sent successfully",
    [Trans.InvitationErrorNoPhoneOrEmail]: "You must specify a phone number or email.",
    [Trans.Ok]: "Ok",
    [Trans.BadRequest]: "The phone sent a bad request, this is an app error and has been logged",
    [Trans.SenderEmailMustNotBeEqualToReceiver]: "You can not send an invitation to yourself",
    [Trans.UserAlreadySentAnInvitation]: "You already sent an invitation to this user.",
    [Trans.ThisUserAlreadyFollowsYou]: "this user already follows you.",
    [Trans.UnableToFindInvitation]: "Unable to find invitation",
    [Trans.UnableToCreateGeofence]: "Unable to create geofence",
    [Trans.UnableToSubscribeToGeofence]: "Unable to subscribe to the geofence",
    [Trans.SubscribedToGeofence]: "Subscribed to geofence",
    [Trans.TryAnotherEmailOrUsername]: "The selected username or email is not available.",
    [Trans.TryAnotherEmail]: "The selected email is not available.",
    [Trans.TryAnotherPhone]: "The selected phone number is not available.",
    [Trans.TryAnotherPhoneOrUsername]: "The selected username or phone number is not available.",
    [Trans.TryAnotherUsername]: "The selected username is not available.",
    [Trans.ValidationWithValue]: "with value",
    [Trans.ValidationIsInvalid]: "is invalid",
    [Trans.EmergencyModePushNotificationBody]:
        "HELP! %s is in an emergency. Please confirm that they are okay.",
    [Trans.NormalModePushNotificationBody]: "%s is no longer in an emergency.",
    [Trans.UserIsNotInAnEmergency]:
        "%s is not in an emergency, historical location tracking is disabled.",
    [Trans.UserIsNotBeingFollowed]: "%s does not follow %s",
    [Trans.ThereIsAnotherDeviceRegistered]: `There is another device registered in your profile, please unregister \
that device first before attempting to login, you can also force to unregister that device.`,
    [Trans.DeleteDeviceSuccess]: "Success, the device was deleted.",
    [Trans.MaxFollowersError]:
        "You reached the max number of followers, to add someone, please delete someone else first",
    [Trans.PushNotificationActionView]: "Go to App",
    [Trans.PushNotificationInvitationAcceptedTitle]: "%s accepted your invitation",
    [Trans.PushNotificationInvitationAcceptedBody]: "%s is now following you",
    [Trans.PushNotificationInvitationCreatedTitle]: "%s sent you an invitation",
    [Trans.PushNotificationInvitationCreatedBody]: "%s wants you to follow them",
    [Trans.SmsInvitationCreatedBody]:
        "%s wants you to follow them in the Armore app. Armore is the best app to track your loved ones using end to end encryption. %s",
    [Trans.SmsInvitationCreatedBodyNewUser]: "Android: %s\n\niOS: %s",
    [Trans.VerificationEmailBody]:
        "Hello %s, please click the link below or use the code to verify that you are the owner of this account.",
    [Trans.VerificationEmailTitle]: "Email Verification Required",
    [Trans.VerificationEmailButtonText]: "Verify",
    [Trans.VerificationSuccess]: "Your account has been successfully verified!",
    [Trans.VerificationFailure]:
        "Unable to verify ownership of this account, please, send another code or try to login again.",
    [Trans.VerificationCreatedSuccessfully]: "Successfully created verification request",
    [Trans.SmsVerificationBody]: "Your Armore verification code is: %s\n%s",
};

export default english;
