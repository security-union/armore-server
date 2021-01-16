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
    DevicePushNotificationRegistration,
    Username,
    UserState,
} from "../types";

import { mapDBDevicesToJSON } from "./db-transformers";
import { LocalizableError } from "../localization/localization";
import { Trans } from "../localization/translation";
import { logger } from "../logger";

interface NewUserState {
    username: string;
    newState: UserState;
}

export const getDevices = ({ username }: Username, database: DBClient) =>
    withDB(database).then(async (d: DBClientWithConnection) => {
        const result = await d.connection.query(
            "SELECT ud.username, ud.device_id, devices.role, devices.name, devices.os, devices.os_version, devices.model " +
                "FROM devices INNER JOIN " +
                "(select * from users_devices where username = $1) as ud ON devices.device_id = ud.device_id " +
                "AND ud.owner = true",
            [username],
        );

        return mapDBDevicesToJSON({ result });
    });

export const deleteDevice = async (
    { username, deviceId }: { username: string; deviceId: string },
    db: DBClientWithConnection,
): Promise<any> => {
    const devicesExists = await db.connection.query(
        `SELECT FROM users_devices
    WHERE device_id = $1
    `,
        [deviceId],
    );

    // The device no longer exists, allow the user to logout, else she will be put in the purgatory.
    if (devicesExists.rowCount === 0) {
        logger.warn(
            `User ${username} attempted to delete a device that no longer exists ${deviceId}`,
        );
        return;
    }

    const result = await db.connection.query(
        `DELETE FROM users_devices
    WHERE username = $1 AND device_id = $2 and owner = true
    `,
        [username, deviceId],
    );
    if (result.rowCount !== 1) {
        throw new LocalizableError(
            Trans.BadRequest,
            402,
            "User does not own the device or it does not exist",
        );
    }
};

export const deletePreviousDevices = async (
    { username }: { username: string },
    database: DBClient,
) =>
    withDB(database).then(async (db: DBClientWithConnection) => {
        const existingDevices = await db.connection.query(
            `SELECT FROM users_devices WHERE username = $1 AND owner = true`,
            [username],
        );

        if (existingDevices.rowCount > 0) {
            await db.connection.query(
                `DELETE
                     FROM users_devices
                     WHERE username = $1
                       AND owner = true
                `,
                [username],
            );
        }
    });

export const unassociateDeviceFromOtherUsers = async (
    { deviceId }: { deviceId: string },
    database: DBClient,
) =>
    withDB(database).then(async (db: DBClientWithConnection) => {
        const existingDevices = await db.connection.query(
            `SELECT FROM users_devices WHERE device_id = $1`,
            [deviceId],
        );

        if (existingDevices.rowCount > 0) {
            await db.connection.query(
                `DELETE
                     FROM users_devices
                     WHERE device_id = $1
                `,
                [deviceId],
            );
        }
    });

export const registerDeviceForPushNotifications = async (
    { username, deviceId, pushToken }: DevicePushNotificationRegistration,
    database: DBClient,
) =>
    withDB(database).then(async (d: DBClientWithConnection) => {
        if (!pushToken || pushToken.length < 1) {
            throw new Error("the push token is invalid");
        }
        const registrationResult = await d.connection.query(
            "UPDATE devices SET push_token = $1 WHERE device_id = $2",
            [pushToken, deviceId],
        );

        if (registrationResult.rowCount < 1) {
            throw new Error("Unable to find device registration, please try to login again");
        }
    });

export const getPushNotificationTokensForDevices = async (
    deviceIdentifiers: string[],
    database: DBClient,
) =>
    withDB(database).then(async (d: DBClientWithConnection) => {
        const deviceIds =
            deviceIdentifiers.length > 0
                ? `(${deviceIdentifiers.map((r) => `'${r}'`).toString()})`
                : "('')";
        const deviceTokens = await d.connection.query(
            `SELECT device_id, push_token, os from devices ` + `WHERE device_id in ${deviceIds}`,
        );
        return deviceTokens.rows.reduce(
            (acc, { device_id, push_token, os }) => ({
                ...acc,
                [device_id]: { pushToken: push_token, os },
            }),
            {},
        );
    });

export const getEmailAndFullName = async (userIds: (string | undefined)[], database: DBClient) =>
    withDB(database).then(async (d: DBClientWithConnection) => {
        const deviceIds =
            userIds.length > 0 ? `(${userIds.map((r) => `'${r}'`).toString()})` : "('')";
        const users = await d.connection.query(
            `SELECT users.username, user_details.first_name, user_details.last_name, users.email ` +
                `FROM users inner JOIN user_details ON ` +
                `users.username = user_details.username WHERE users.username IN ${deviceIds}`,
        );
        return users.rows.reduce(
            (acc, { username, first_name, last_name, email }) => ({
                ...acc,
                [username]: { fistName: first_name, lastName: last_name, email },
            }),
            {},
        );
    });

export const updateUserState = async (w: NewUserState, db: DBClientWithConnection) => {
    return await db.connection.query(
        `UPDATE users_state set self_perception = $1 where username = $2`,
        [w.newState, w.username],
    );
};
