/**
 * Copyright [2020] [Dario Alessandro Lencina Talarico]
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

import { withDB, DBClient } from "./db";

import {
    Username,
    DBClientWithConnection,
    RejectInvitation,
    CancelInvitation,
    AcceptInvitation,
    CreateInvitation,
    ValidateInvitation,
    GetInvitationsResponse,
    UserInfo,
    InvitationType,
    FollowerInvitation,
    AccessType,
} from "../types";

import { mapDBDeviceToJSON, mapInvitationsToJSON, mapDBUserToJSON } from "./db-transformers";
import { LocalizableError } from "../localization/localization";
import { Trans } from "../localization/translation";
import { MAX_FOLLOWERS } from "../constants";
import { QueryResult } from "pg";

const targetUserQuery = async (
    emailOrPhone: string,
    database: DBClientWithConnection,
): Promise<QueryResult> => {
    return database.connection.query(
        "select username from users where (email = $1 or phone_number = $1)",
        [emailOrPhone],
    );
};

const getInvitations2 = async (
    { username }: Username,
    c: DBClientWithConnection,
): Promise<GetInvitationsResponse<any>> => {
    const sent = await c.connection.query(
        "SELECT ud.target_email, ud.target_phone_number, ud.id, ud.creator_username, " +
            "ud.target_username, ud.status, ud.invitation, " +
            "ud.type, ud.creation_timestamp, ud.update_timestamp " +
            "FROM " +
            "(SELECT id, creator_username, target_username, target_email, status, invitation, " +
            "type, creation_timestamp, update_timestamp, target_phone_number " +
            "FROM invitations " +
            "WHERE creator_username = $1 and (status = 'created')) as ud " +
            "LEFT JOIN users " +
            "ON (ud.target_email = users.email) OR (ud.target_phone_number = users.phone_number)",
        [username],
    );

    const received = await c.connection.query(
        "SELECT ud.target_email, ud.id, ud.creator_username, " +
            "ud.target_username, ud.status, ud.invitation, ud.target_phone_number, " +
            "ud.type, ud.creation_timestamp, ud.update_timestamp " +
            "FROM " +
            "(SELECT id, creator_username, target_username, target_email, status, invitation, " +
            "type, creation_timestamp, update_timestamp, target_phone_number " +
            "FROM invitations  " +
            "WHERE (target_username = $1) and (status = 'created')) as ud " +
            "LEFT JOIN users " +
            "ON (ud.target_email = users.email) OR (ud.target_phone_number = users.phone_number)",
        [username],
    );

    const getDeviceId = (row: { invitation: { deviceId: string } }) =>
        `'${row.invitation.deviceId}'`;
    const allDeviceIds = [
        ...new Set([...sent.rows.map(getDeviceId), ...received.rows.map(getDeviceId)]),
    ];
    const devicesToLookFor = allDeviceIds.length > 0 ? `(${allDeviceIds.toString()})` : "('')";
    const allInvolvedDevices = await c.connection.query(
        `SELECT * from devices where device_id in ${devicesToLookFor}`,
    );
    const devicesMap = allInvolvedDevices.rows.reduce((acc, value) => {
        return { ...acc, [value.device_id]: mapDBDeviceToJSON(value) };
    }, {});

    const getUsername = (row: { target_username: string; creator_username: string }) => [
        `'${row.target_username}'`,
        `'${row.creator_username}'`,
    ];
    const allUsernames = [
        ...new Set([...sent.rows.flatMap(getUsername), ...received.rows.flatMap(getUsername)]),
    ];
    const usersToLookFor = allUsernames.length > 0 ? `(${allUsernames.toString()})` : "('')";
    const allUsers = await c.connection.query(
        `SELECT * from user_details ` +
            `INNER JOIN users ON user_details.username = users.username ` +
            `WHERE user_details.username IN ${usersToLookFor}`,
    );

    const usersMap = allUsers.rows.reduce(
        (acc, value) => ({ ...acc, [value.username]: mapDBUserToJSON(value) }),
        {},
    );

    return mapInvitationsToJSON({ sent, received, devicesMap, usersMap });
};

export const getInvitations = async ({ username }: Username, database: DBClient) =>
    withDB(database).then(
        async (c: DBClientWithConnection): Promise<GetInvitationsResponse<any>> => {
            return getInvitations2({ username }, c);
        },
    );

export const rejectInvitation = async (
    { username, id }: RejectInvitation,
    c: DBClientWithConnection,
) => {
    const result = await c.connection.query(
        "UPDATE invitations " +
            "SET status = 'rejected' " +
            "WHERE id = $1 and target_username = $2 and status = 'created'",
        [id, username],
    );

    if (result.rowCount === 0) {
        throw new LocalizableError(
            Trans.UnableToFindInvitation,
            401,
            `Unable to find info for user ${username}`,
        );
    }
};

export const cancelInvitation = async (
    { username, id }: CancelInvitation,
    c: DBClientWithConnection,
) => {
    const result = await c.connection.query(
        "UPDATE invitations " +
            "SET status = 'canceled' " +
            "WHERE id = $1 and creator_username = $2 and status = 'created'",
        [id, username],
    );

    if (result.rowCount === 0) {
        throw new LocalizableError(Trans.UnableToFindInvitation, 401);
    }
};

export const acceptInvitation = async (
    { username, id }: AcceptInvitation,
    c: DBClientWithConnection,
) => {
    const invitations = await c.connection.query("SELECT type from invitations WHERE id = $1", [
        id,
    ]);
    if (invitations.rowCount == 1) {
        switch (invitations.rows[0].type) {
            case InvitationType.Follower:
                await acceptFollowerInvitation({ username, id }, c);
                break;
            default:
                throw new LocalizableError(
                    Trans.UnableToFindInvitation,
                    401,
                    `Unable to match invitation type ${JSON.stringify(invitations.rows[0].type)}`,
                );
        }
    } else {
        throw new LocalizableError(Trans.UnableToFindInvitation, 401);
    }
};

export const acceptFollowerInvitation = async (
    { username, id }: AcceptInvitation,
    database: DBClientWithConnection,
) => {
    const result = await database.connection.query(
        "UPDATE invitations " +
            "SET status = 'accepted' " +
            "WHERE id = $1 and target_username = $2 and status = 'created'",
        [id, username],
    );

    if (result.rowCount === 0) {
        throw new LocalizableError(Trans.UnableToFindInvitation, 401);
    }

    const { rows } = await database.connection.query("SELECT * from invitations where id = $1", [
        id,
    ]);

    const { creator_username, target_username } = rows[0];

    // If the target_username is null, use the current username as the target_username.
    const usernameFollower = target_username ? target_username : username;
    await database.connection.query("CALL add_friend($1, $2)", [
        creator_username,
        usernameFollower,
    ]);
};

export const createInvitation = async (
    { username, invitation }: CreateInvitation<any>,
    database: DBClientWithConnection,
) => {
    switch (invitation.type) {
        default:
            await validateFollowerInvitation({ invitation, username }, database);
            break;
    }

    const targetUserResult = await targetUserQuery(
        invitation.targetEmail ? invitation.targetEmail : invitation.targetPhoneNumber,
        database,
    );

    const query =
        targetUserResult.rowCount > 0
            ? await database.connection.query(
                  `insert into invitations ` +
                      `(creator_username, target_username, target_email, target_phone_number, type, invitation, id, status, creation_timestamp, update_timestamp) ` +
                      `VALUES ($1, $2, $3, $4, $5, $6, uuid_generate_v4(), 'created', NOW()::timestamp, NOW()::timestamp)`,
                  [
                      username,
                      targetUserResult.rows[0].username,
                      invitation.targetEmail,
                      invitation.targetPhoneNumber,
                      invitation.type,
                      invitation.invitation,
                  ],
              )
            : await database.connection.query(
                  `insert into invitations ` +
                      `(creator_username, target_email, target_phone_number, type, invitation, id, status, creation_timestamp,  update_timestamp)` +
                      `VALUES ($1, $2, $3, $4, $5, uuid_generate_v4(), 'created', NOW()::timestamp, NOW()::timestamp)`,
                  [
                      username,
                      invitation.targetEmail,
                      invitation.targetPhoneNumber,
                      invitation.type,
                      invitation.invitation,
                  ],
              );
    return query.rowCount === 1;
};

const validateFollowerInvitation = async (
    { invitation, username }: ValidateInvitation<FollowerInvitation>,
    database: DBClientWithConnection,
) => {
    if (invitation.type !== InvitationType.Follower) {
        throw new LocalizableError(Trans.BadRequest, 401, "invalid request type");
    }
    if (
        typeof invitation.invitation.accessType !== "string" ||
        !AccessType[invitation.invitation.accessType]
    ) {
        throw new LocalizableError(Trans.BadRequest, 401, "invalid access type");
    }
    if (typeof invitation.invitation.isEmergencyContact !== "boolean") {
        throw new LocalizableError(
            Trans.BadRequest,
            401,
            "Invitation does not have a property: isEmergencyContact or it is not boolean.",
        );
    }

    const followers = (
        await database.connection.query(
            "SELECT * FROM users_followers " + "WHERE users_followers.username = $1",
            [username],
        )
    ).rowCount;

    const sentInvitations = (await getInvitations2({ username }, database)).sent.length;

    if (sentInvitations + followers >= MAX_FOLLOWERS) {
        throw new LocalizableError(
            Trans.UserAlreadySentAnInvitation,
            401,
            `Max number of followers reached: ${MAX_FOLLOWERS}`,
        );
    }

    const targetUserResult = await targetUserQuery(
        invitation.targetEmail ? invitation.targetEmail : invitation.targetPhoneNumber,
        database,
    );

    if (targetUserResult.rowCount === 1) {
        const [{ username: targetUsername }] = targetUserResult.rows;
        if (targetUsername === username) {
            throw new LocalizableError(Trans.SenderEmailMustNotBeEqualToReceiver, 501);
        }

        // Can not create more than 1 invite for the same device and same target_username.
        const invitationQuery = await database.connection.query(
            "SELECT * FROM invitations " +
                "WHERE creator_username = $1 and target_username = $2 and invitation = $3 and status = 'created'",
            [username, targetUsername, invitation.invitation],
        );

        if (invitationQuery.rowCount > 0) {
            throw new LocalizableError(Trans.UserAlreadySentAnInvitation, 401);
        }

        const existingUsersFollowers = await database.connection.query(
            "SELECT * from users_followers where username_follower = $1 and username = $2",
            [targetUsername, username],
        );

        if (existingUsersFollowers.rowCount > 0) {
            throw new LocalizableError(Trans.ThisUserAlreadyFollowsYou, 401);
        }
    } else {
        // Can not create more than 1 invite for the same device and same target_email.
        const invitationQuery = await database.connection.query(
            "SELECT * from invitations where creator_username = $1 and (target_email = $2 or target_phone_number = $3) and invitation = $4 and status = 'created'",
            [username, invitation.targetEmail, invitation.targetPhoneNumber, invitation.invitation],
        );

        if (invitationQuery.rowCount > 0) {
            throw new LocalizableError(Trans.UserAlreadySentAnInvitation, 401);
        }
    }
};

export const getAllDevicesForUserWithEmailOrPhone = async (emailOrPhone: string, db: DBClient) =>
    withDB(db).then(
        async (c: DBClientWithConnection): Promise<string[]> => {
            const deviceIds = await c.connection.query(
                `SELECT users_devices.device_id FROM users JOIN users_devices ` +
                    `ON users.username = users_devices.username ` +
                    `WHERE (email = $1 OR phone_number = $1) AND users_devices.owner = true`,
                [emailOrPhone],
            );
            return deviceIds.rows.map((row) => row.device_id);
        },
    );

export const getUserInfo = async (username: string, database: DBClient) =>
    withDB(database).then(
        async (c: DBClientWithConnection): Promise<UserInfo> => {
            const userInfo = await c.connection.query(
                `SELECT users.email, users.phone_number, user_details.username, user_details.first_name, user_details.last_name, user_details.picture, ` +
                    `user_details.language FROM users INNER JOIN user_details ` +
                    `ON users.username = user_details.username WHERE users.username = $1`,
                [username],
            );
            const result = userInfo.rows.map((row) => ({
                email: row.email,
                phoneNumber: row.phone_number,
                username: row.username,
                firstName: row.first_name,
                lastName: row.last_name,
                picture: row.picture,
                language: row.language,
            }));
            if (result.length > 0) {
                return result[0];
            } else {
                throw new LocalizableError(
                    Trans.InternalServerError,
                    501,
                    `Unable to find info for user ${username}`,
                );
            }
        },
    );

export const getUserInfoWithEmailOrPhone = async (emailOrPhone: string, database: DBClient) =>
    withDB(database).then(
        async (c: DBClientWithConnection): Promise<UserInfo | undefined> => {
            const userInfo = await c.connection.query(
                `SELECT users.email, users.phone_number, user_details.username, user_details.first_name, user_details.last_name, user_details.language, ` +
                    `user_details.language FROM users INNER JOIN user_details ` +
                    `ON users.username = user_details.username WHERE (users.email = $1 or users.phone_number = $1)`,
                [emailOrPhone],
            );
            const result = userInfo.rows.map((row) => ({
                email: row.email,
                phoneNumber: row.phone_number,
                username: row.username,
                firstName: row.first_name,
                lastName: row.last_name,
                picture: row.picture,
                language: row.language,
            }));

            if (result.length > 0) {
                return result[0];
            } else {
                return undefined;
            }
        },
    );
