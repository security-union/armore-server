## E2E Encryption

### Prerequisites to read this document (watch in order)

Diffie Hellman
https://www.youtube.com/watch?v=NmM9HA2MQGI
math: https://www.youtube.com/watch?v=Yjrfm_oRO0w

Elliptic Curve Diffie Hellman
https://www.youtube.com/watch?v=NF1pwjL9-DE

End 2 End Encryption
https://www.youtube.com/watch?v=DXv1boalsDI

Public Key Cryptography
https://www.youtube.com/watch?v=GSIDS_lvRv4

### Goals

1. The server should not have raw access to the user's location.
2. Even if a hacker breaks into the database, they should not be able to determine where users are.

### Functional Requirements.

1. Transparency: As an Armore user, I should be able to add and remove friends without knowing about the underlying encryption
   technology.

2. Algorithm to be used to encrypt/decrypt messages: RSA with key length: 4096

3. Max number of devices: A given user should be able to only have **1 active device** at any time.

3.1 If a user tries to login through a second device, she will pre prompted to first logout from the first device OR
to go ahead and login with the new device and forcefully unregister the previous phone.

## Quality attributes.

1. Reliability: Tolerance to bad encrypted messages: If a phone fails to decrypt an inbound location message, then it should just
   drop it instead of throwing exceptions or crashing.

2. Portability: Users should be prompted to use iCloud and whatever is the equivalent on Android to back up their
   identity.

### Architecture

#### 1. Registration

1.1 Initial user registration: a public key base64 encoded is added to the request.

#### 2 Login:

2.1 Assume that the key has not been registered with the server, go ahead and send the public key that was
generated during registration to the login service.

#### 3 Logout:

There will be a logout service that will have the effect of deleting the corresponding public user key and device
registration.

During logout, the developer is responsible for deleting all local storage including encryption keys.

#### 4. Changes to Invitations (if any)

4.1 No changes to the request.

#### 5. Changes to sending receiving location updates.

    5.1 A new service has been created for posting telemetry, it is documented in http_gateway_v1.yaml
    5.2 The biggest difference is that the developer is responsible for pushing an array of encrypted location
    objects, one per follower.
    5.3 To accomplish 4.2 the user must fetch all the public keys of her/his followers.
    5.4 Lazy key fetching:
        4.4.1 If the phone receives a new follower while parsing the telemetry response that it does not have, then
        it should pull all public keys again and persist them for further use.
        4.4.2 Each phone is responsible for refreshing public keys every 5 minutes, even when the app is in the background.

#### 6. Historical Location.

    6.1 No changes to the endpoint or parameters, the only difference is that the response will have encrypted data
    messages as opposed to raw telemetry objects. Please refer to the http_gateway.yaml open api doc.
