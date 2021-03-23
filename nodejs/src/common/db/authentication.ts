/**
 * Copyright [2018] [Dario Alessandro Lencina Talarico]
 * Licensed under the Apache License, Version 2.0 (the "License");
 * y ou may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { DBClient, withDB } from "./db";
import {
    DBClientWithConnection,
    EmailRegistration,
    PhoneRegistration,
    Username,
    Device2,
    UserState,
    UserDetails,
    EmailVerificationRequest,
    SmsVerificationRequest,
} from "../types";

import { DEFAULT_NUMBER_OF_FOLLOWERS_TO_DECLARE_EMERGENCY } from "../../auth_server/constants";
import { LocalizableError } from "../localization/localization";
import { Trans } from "../localization/translation";

export const registerWithEmail = async (
    { username, email, firstName, lastName, picture, publicKey, language }: EmailRegistration,
    d: DBClientWithConnection,
) => {
    try {
        const createUser = await d.connection.query(
            `insert into users (username,  email) values ($1, $2)`,
            [username, email],
        );
        if (createUser.rowCount !== 1) {
            throw new LocalizableError(Trans.InternalServerError, 501, "Unable to create user");
        }
    } catch (e) {
        if (e.message && e.message.includes("users_email_key")) {
            throw new LocalizableError(Trans.TryAnotherEmail, 401, e.message);
        } else if (e.message && e.message.includes("users_pkey")) {
            throw new LocalizableError(Trans.TryAnotherUsername, 401, e.message);
        } else {
            throw new LocalizableError(Trans.TryAnotherEmailOrUsername, 401, e.message);
        }
    }

    const createUserDetails = await d.connection.query(
        `insert into user_details
            (username, first_name, last_name, picture, language, creation_timestamp, updated_timestamp)
            values ($1, $2, $3, $4, $5, now(), now())
        `,
        [username, firstName, lastName, picture, language],
    );

    if (createUserDetails.rowCount !== 1) {
        throw new LocalizableError(Trans.InternalServerError, 501, "Unable to create user");
    }

    const createUsersState = await d.connection.query(
        `INSERT INTO users_state (username, self_perception) VALUES ($1, $2)`,
        [username, UserState.Normal],
    );

    if (createUsersState.rowCount !== 1) {
        throw new LocalizableError(Trans.InternalServerError, 501, "Unable to create user state");
    }

    const createUsersSettings = await d.connection.query(
        `INSERT INTO users_settings (username, followers_to_declare_emergency)
            VALUES ($1, $2)`,
        [username, DEFAULT_NUMBER_OF_FOLLOWERS_TO_DECLARE_EMERGENCY],
    );

    if (createUsersSettings.rowCount !== 1) {
        throw new LocalizableError(
            Trans.InternalServerError,
            501,
            "Unable to create users settings",
        );
    }
};

export const registerWithPhone = async (
    { username, phoneNumber, firstName, lastName, picture, publicKey, language }: PhoneRegistration,
    d: DBClientWithConnection,
) => {
    try {
        const createUser = await d.connection.query(
            `insert into users (username,  phone_number) values ($1, $2)`,
            [username, phoneNumber],
        );
        if (createUser.rowCount !== 1) {
            throw new LocalizableError(Trans.InternalServerError, 501, "Unable to create user");
        }
    } catch (e) {
        if (e.message && e.message.includes("users_phone_number_key")) {
            throw new LocalizableError(Trans.TryAnotherPhone, 401, e.message);
        } else if (e.message && e.message.includes("users_pkey")) {
            throw new LocalizableError(Trans.TryAnotherUsername, 401, e.message);
        } else {
            throw new LocalizableError(Trans.TryAnotherPhoneOrUsername, 401, e.message);
        }
    }

    const createUserDetails = await d.connection.query(
        `insert into user_details
            (username, first_name, last_name, picture, language, creation_timestamp, updated_timestamp)
            values ($1, $2, $3, $4, $5, now(), now())
        `,
        [username, firstName, lastName, picture, language],
    );

    if (createUserDetails.rowCount !== 1) {
        throw new LocalizableError(Trans.InternalServerError, 501, "Unable to create user");
    }

    const createUsersState = await d.connection.query(
        `INSERT INTO users_state (username, self_perception) VALUES ($1, $2)`,
        [username, UserState.Normal],
    );

    if (createUsersState.rowCount !== 1) {
        throw new LocalizableError(Trans.InternalServerError, 501, "Unable to create user state");
    }

    const createUsersSettings = await d.connection.query(
        `INSERT INTO users_settings (username, followers_to_declare_emergency)
            VALUES ($1, $2)`,
        [username, DEFAULT_NUMBER_OF_FOLLOWERS_TO_DECLARE_EMERGENCY],
    );

    if (createUsersSettings.rowCount !== 1) {
        throw new LocalizableError(
            Trans.InternalServerError,
            501,
            "Unable to create users settings",
        );
    }
};

export const registerPublicKey2 = async (
    { username, publicKey }: { username: string; publicKey: string },
    c: DBClient,
) => withDB(c).then((cc) => registerPublicKey({ username, publicKey }, cc));

export const registerPublicKey = async (
    { username, publicKey }: { username: string; publicKey: string },
    c: DBClientWithConnection,
) => {
    const registerPk = await c.connection.query(
        `
                INSERT INTO users_identity (username, public_key, update_timestamp)
                VALUES ($1, $2, now())
                ON CONFLICT (username)
                    DO UPDATE
                    SET public_key = $2, update_timestamp = now();
        `,
        [username, publicKey],
    );

    if (registerPk.rowCount !== 1) {
        throw new LocalizableError(Trans.InternalServerError, 501, "Unable to update public key");
    }
};

export const updateUserLanguage = async (
    { username, language }: { username: string; language: string },
    database: DBClient,
): Promise<any> =>
    withDB(database).then(async (d: DBClientWithConnection) => {
        await d.connection.query(
            `
        UPDATE user_details set language = $1 where username = $2
        `,
            [language, username],
        );
    });

export const updateProfileImage = async (
    { username }: Username,
    pictureName: string,
    database: DBClient,
): Promise<any> =>
    withDB(database).then(async (d: DBClientWithConnection) => {
        await d.connection.query(
            `
        UPDATE user_details set picture = $1, updated_timestamp = now() where username = $2
        `,
            [pictureName, username],
        );
    });

export const getUserDetails = async (
    { username }: Username,
    database: DBClient,
): Promise<UserDetails> =>
    withDB(database).then(async (d: DBClientWithConnection) => {
        const userDetailsQuery = await d.connection.query(
            `SELECT * FROM user_details ` +
                `INNER JOIN users_settings ON users_settings.username = user_details.username ` +
                `INNER JOIN users ON users.username = user_details.username ` +
                `INNER JOIN users_state ON users.username = users_state.username ` +
                `WHERE user_details.username = $1`,
            [username],
        );

        const followersPerception = (
            await d.connection.query(
                `SELECT username_follower, follower_perception FROM users_followers_state ` +
                    `WHERE username = $1`,
                [username],
            )
        ).rows.map((row) => ({
            username: row.username_follower,
            perception: row.follower_perception,
        }));

        if (userDetailsQuery.rowCount === 1) {
            const userInfoRow = userDetailsQuery.rows[0];
            return {
                language: userInfoRow.language,
                phoneNumber: userInfoRow.phone_number ? userInfoRow.phone_number : undefined,
                email: userInfoRow.email ? userInfoRow.email : undefined,
                firstName: userInfoRow.first_name,
                lastName: userInfoRow.last_name,
                picture: userInfoRow.picture ? userInfoRow.picture : undefined,
                settings: {
                    followersNeededToDeclareEmergency: userInfoRow.followers_to_declare_emergency,
                },
                userState: {
                    selfPerceptionState: userInfoRow.self_perception,
                    followersPerception,
                },
                username,
            };
        } else {
            throw new LocalizableError(Trans.InternalServerError, 501, "Unable to fetch user info");
        }
    });

export const updateUserDetails = async (
    { username }: Username,
    email: string | undefined,
    firstName: string | undefined,
    lastName: string | undefined,
    phoneNumber: string | undefined,
    db: DBClient,
) =>
    withDB(db).then(async (d: DBClientWithConnection) => {
        await d.connection.query(
            "UPDATE user_details SET \
                first_name = COALESCE($2, first_name), \
                last_name = COALESCE($3, last_name) \
            WHERE username = $1;",
            [username, firstName, lastName],
        );

        await d.connection.query(
            "UPDATE users SET \
                email = COALESCE($2, email), \
                phone_number = COALESCE($3, phone_number) \
            WHERE username = $1;",
            [username, email, phoneNumber],
        );
    });

export const registerDevice = async (
    { username, deviceId, os, osVersion, model, appVersion }: Device2,
    database: DBClient,
) =>
    withDB(database).then(async (d: DBClientWithConnection) => {
        if (!deviceId || deviceId.length < 5) {
            throw new LocalizableError(Trans.InternalServerError, 501, "DeviceId is too short");
        }

        // TODO: Handle scenario where device changes owner.
        const verifyRegistration = await d.connection.query(
            "select device_id, username from users_devices where device_id = $1 and owner = true",
            [deviceId],
        );
        if (verifyRegistration.rowCount > 0) {
            if (verifyRegistration.rows[0].username === username) {
                return;
            } else {
                // Device changed hands, update registration.
                throw new LocalizableError(Trans.DeviceIsRegisteredToAnotherUser, 402);
            }
        } else {
            // Check the # of devices registered to the account.
            const currentDevices = await d.connection.query(
                "select device_id, username from users_devices where username = $1 and owner = true",
                [username],
            );

            if (currentDevices.rowCount > 0) {
                throw new LocalizableError(
                    Trans.ThereIsAnotherDeviceRegistered,
                    402,
                    "Unable to register device because the user has another device registered",
                );
            }

            const insertToDeviceOwners = await d.connection.query(
                "insert into users_devices (username, device_id, owner, access_enabled, permissions) values ($1, $2, $3, $4, $5)",
                [username, deviceId, true, true, { permanentAccess: true }],
            );
            if (insertToDeviceOwners.rowCount === 0) {
                throw new LocalizableError(
                    Trans.InternalServerError,
                    501,
                    "Unable to register device into the users_devices table",
                );
            }
            const createDevice = await d.connection.query(
                `insert into devices (device_id, role, name, os, os_version, model, app_version)
                 values ($1, $2, $3, $4, $5, $6, $7)`,
                [deviceId, "phone", deviceId, os, osVersion, model, appVersion],
            );
            if (createDevice.rowCount === 0) {
                throw new LocalizableError(
                    Trans.InternalServerError,
                    501,
                    "Unable to register device into the devices table",
                );
            }
        }
    });

export const getEmail = async ({ username }: Username, database: DBClient) =>
    withDB(database).then(async (d: DBClientWithConnection) => {
        const result = await d.connection.query("SELECT email FROM users where username=$1", [
            username,
        ]);
        return result.rowCount === 1 ? result.rows[0].email : undefined;
    });

export const associateUserAndPhone = async ({ username, phone_number}: { username: string, phone_number: string}, database: DBClient) =>
    withDB(database).then(async (d: DBClientWithConnection) => {
        const createUser = await d.connection.query(
            `insert into users (username,  phone_number) values ($1, $2)`,
            [username, phone_number],
        );
        if (createUser.rowCount !== 1) {
            throw new LocalizableError(Trans.InternalServerError, 501, "Unable to create user");
        }
    });        

export const associateUserAndEmail = async ({ username, email}: { username: string, email: string}, database: DBClient) =>
    withDB(database).then(async (d: DBClientWithConnection) => {
        const createUser = await d.connection.query(
            `insert into users (username,  email) values ($1, $2)`,
            [username, email],
        );
        if (createUser.rowCount !== 1) {
            throw new LocalizableError(Trans.InternalServerError, 501, "Unable to create user");
        }
    });        

export const getUsername = async (emailOrPhone: String, database: DBClient): Promise<Username> =>
    withDB(database).then(async (d: DBClientWithConnection) => {
        const result = await d.connection.query(
            "SELECT username FROM users where email=$1 or phone_number=$1",
            [emailOrPhone],
        );
        const username = result.rowCount === 1 ? result.rows[0].username : undefined;
        return { username };
    });

export const userWithPhoneExists = async (emailOrPhone: string, database: DBClient) =>
    withDB(database).then(
        async (d: DBClientWithConnection): Promise<Boolean> => {
            const {
                rowCount,
            } = await d.connection.query("SELECT * FROM users WHERE phone_number = $1", [
                emailOrPhone,
            ]);
            return rowCount > 0;
        },
    );

export const userWithEmailExists = async (email: string, database: DBClient) =>
    withDB(database).then(
        async (d: DBClientWithConnection): Promise<Boolean> => {
            const { rowCount } = await d.connection.query(
                `
                    SELECT *
                    FROM users
                    WHERE email = $1;`,
                [email],
            );
            return rowCount > 0;
        },
    );

export const createEmailVerificationRequest = async (
    email: String,
    publicKey: String,
    database: DBClient,
) =>
    withDB(database).then(
        async (d: DBClientWithConnection): Promise<EmailVerificationRequest> => {
            const verificationCode = createVerificationCode(5);
            const result = await d.connection.query(
                `INSERT INTO users_verification
                    (verification_code, email, public_key, used, creation_timestamp, updated_timestamp, expiration_timestamp)
                    VALUES ($1, $2, $3, false, NOW()::timestamp, NOW()::timestamp, (NOW() + interval '60 minute')::timestamp)
                    RETURNING verification_id as "verificationId", expiration_timestamp as "expirationTimestamp", used`,
                [verificationCode, email, publicKey],
            );
            if (result.rowCount === 0) {
                throw new LocalizableError(
                    Trans.InternalServerError,
                    501,
                    "Unable to create verification code",
                );
            }
            const { verificationId, expirationTimestamp } = result.rows[0];
            return { email, verificationId, verificationCode, expirationTimestamp };
        },
    );

export const createSmsVerificationRequest = async (
    phoneNumber: String,
    publicKey: String,
    database: DBClient,
) =>
    withDB(database).then(
        async (d: DBClientWithConnection): Promise<SmsVerificationRequest> => {
            const verificationCode = createVerificationCode(5);
            const result = await d.connection.query(
                `INSERT INTO users_verification
                            (verification_code, phone_number, public_key, used, creation_timestamp, updated_timestamp, expiration_timestamp)
                            VALUES ($1, $2, $3, false, NOW()::timestamp, NOW()::timestamp, (NOW() + interval '60 minute')::timestamp)
                            RETURNING verification_id as "verificationId", expiration_timestamp as "expirationTimestamp";`,
                [verificationCode, phoneNumber, publicKey],
            );
            if (result.rowCount === 0) {
                throw new LocalizableError(
                    Trans.InternalServerError,
                    501,
                    "Unable to create verification code",
                );
            }
            const { expirationTimestamp, verificationId } = result.rows[0];
            return {
                expirationTimestamp,
                phoneNumber,
                verificationCode,
                verificationId,
            };
        },
    );

interface UserVerification {
    email: string | undefined

    phone_number: string | undefined

    username: string
}

export const validateVerificationRequest = async (
    email: string,
    code: string,
    database: DBClient,
) =>
    withDB(database).then(
        async (d: DBClientWithConnection): Promise<UserVerification> => {
            const verificationCodeUpdate = await d.connection.query(
                `UPDATE users_verification
                SET used = true, updated_timestamp = NOW()
                WHERE (email = $1 OR phone_number = $1)
                  AND verification_code = $2
                  AND expiration_timestamp > NOW()
                  AND used = false
                  RETURNING users_verification.*`,
                [email, code],
            );
            if (verificationCodeUpdate.rowCount < 1) {
                throw new LocalizableError(
                    Trans.VerificationFailure,
                    401,
                    "verification failure",
                );
            }
            return verificationCodeUpdate.rows.reduce((acc, row) => row, {});
        },
    );

const numbers = "456789123";
const letters = "abcdefghijklMNOPQRSTUVWXYZ0123ABCDEFGHIJKLmnopqrstuvwxyz";

/**
 * Creates a verification code with a mixture of numbers and letters of the specified length.
 * @param length
 */
function createVerificationCode(length: Number) {
    const result = [];
    // First char is always a letter.
    let collectionPtr = numbers;
    for (let i = 0; i < length; i++) {
        result.push(collectionPtr.charAt(Math.floor(Math.random() * collectionPtr.length)));
        // Toggle sequence
        collectionPtr = collectionPtr.length == numbers.length ? letters : numbers;
    }
    return result.join("");
}
