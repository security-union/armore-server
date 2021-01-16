import { DBClient, withDB } from "./db";
import {
    AccessType,
    DBClientWithConnection,
    Device,
    NotificationRecipient,
    UserDetails,
    UserInfo,
    UserState,
} from "../types";
import { groupBy, head, mapValues } from "lodash";

interface SocialConnections {
    followers: Record<string, any>;
    following: Record<string, any>;
}

const mapRowToUser = (row: any): UserInfo => ({
    username: row.username,
    email: row.email ? row.email : undefined,
    phoneNumber: row.phone_number ? row.phone_number : undefined,
    firstName: row.first_name,
    lastName: row.last_name,
    picture: row.picture ? row.picture : undefined,
    language: row.language,
});

/**
 * Returns follower devices to notified given the user state.
 * @param userDetails
 * @param database
 * @return <Promise<Device[]>>
 */
export const getDevicesToBeNotified = async (
    userDetails: UserDetails,
    database: DBClient,
): Promise<Device[]> =>
    withDB(database).then(
        async (conn: DBClientWithConnection): Promise<Device[]> => {
            const {
                username,
                userState: { selfPerceptionState },
            } = userDetails;
            return (
                await conn.connection.query(
                    "SELECT username_follower, device_id, access_type FROM users_followers " +
                        "INNER JOIN users_devices on users_devices.username  = users_followers.username_follower " +
                        "where users_followers.username = $1",
                    [username],
                )
            ).rows
                .filter(
                    (row) =>
                        selfPerceptionState === UserState.Emergency ||
                        row.access_type === AccessType.Permanent,
                )
                .map((row) => ({
                    username: row.username_follower,
                    deviceId: row.device_id,
                }));
        },
    );

export const getConnections = async (username: string, database: DBClient) =>
    withDB(database).then(
        async (conn: DBClientWithConnection): Promise<SocialConnections> => {
            const followers = (
                await conn.connection.query(
                    "SELECT * FROM users_followers " +
                        "INNER JOIN users " +
                        "ON users.username = users_followers.username_follower " +
                        "INNER JOIN user_details " +
                        "ON user_details.username = users_followers.username_follower " +
                        "WHERE users_followers.username = $1",
                    [username],
                )
            ).rows.map((row: any) => ({
                userDetails: mapRowToUser(row),
                accessType: row.access_type,
                isEmergencyContact: row.is_emergency_contact,
            }));

            const groupedByUser = groupBy(followers, (row: any) => row.userDetails.username);
            const mapped = mapValues(groupedByUser, (obj: any) => head(obj));
            return {
                followers: mapped,
                following: await getFollowingLastLocation(username, database),
            };
        },
    );

interface RemoveFollowerRequest {
    usernameFollower: string;
    username: string;
}

export const changeAccessType = async (
    { follower, username, accessType }: { follower: string; username: string; accessType: string },
    database: DBClientWithConnection,
) => {
    const result = await database.connection.query(
        "UPDATE users_followers SET access_type=$3 WHERE username=$1 AND username_follower=$2",
        [username, follower, accessType],
    );
    if (result.rowCount === 0) {
        throw new Error("Unable to update state");
    }
};

export const removeFollower = async (
    { username, usernameFollower }: RemoveFollowerRequest,
    database: DBClientWithConnection,
) => {
    const result = await database.connection.query("CALL remove_friend($1, $2)", [
        username,
        usernameFollower,
    ]);

    if (result.rowCount === 0) {
        throw new Error("Unable to find connection");
    }
};

export const getFollowingLastLocation = async (username: string, database: DBClient) =>
    withDB(database).then(
        async (d: DBClientWithConnection): Promise<Record<string, any>> => {
            const deviceLocations = await d.connection.query(
                `
        SELECT t.username, t.device_id as "deviceId", t.location,
        t.creation_timestamp as "creationTimestamp", user_details.first_name as "firstName",
        user_details.last_name as "lastName", users.email, user_details.picture,
        users_state.self_perception, users_followers.access_type,
        devices.os, devices.model, devices.os_version as "osVersion"
        FROM device_locations t
        INNER JOIN (
            SELECT device_locations.device_id, max(device_locations.creation_timestamp) AS MaxDate
            FROM device_locations
            WHERE device_id IN (
                SELECT users_devices.device_id from users_followers
                INNER JOIN users_devices ON users_followers.username = users_devices.username
                WHERE users_followers.username_follower = $1 and users_devices.access_enabled = true
                AND users_devices.owner = true
            )
            GROUP BY device_locations.device_id
        ) tm ON t.device_id = tm.device_id and t.creation_timestamp = tm.MaxDate
        INNER JOIN user_details ON user_details.username = t.username
        INNER JOIN users ON users.username = user_details.username
        INNER JOIN devices ON t.device_id = devices.device_id
        INNER JOIN users_state ON users_state.username = user_details.username
        INNER JOIN users_followers ON users_followers.username = user_details.username
        ORDER BY t.username DESC
        `,
                [username],
            );

            const groupedByUser = groupBy(deviceLocations.rows, (row: any) => row.username);
            return mapValues(groupedByUser, (userDevices) => {
                const headUserDetails = head(userDevices);
                const userDetails: UserInfo | undefined = headUserDetails
                    ? {
                          username: headUserDetails.username,
                          firstName: headUserDetails.firstName,
                          lastName: headUserDetails.lastName,
                          email: headUserDetails.email,
                          phoneNumber: headUserDetails.phoneNumber,
                          picture: headUserDetails.picture,
                          language: headUserDetails.language,
                      }
                    : undefined;
                const devices = userDevices.map((row: any) => ({
                    deviceId: row.deviceId,
                    os: row.os,
                    osVersion: row.osVersion,
                    telemetry:
                        headUserDetails.access_type === AccessType.EmergencyOnly &&
                        headUserDetails.self_perception === UserState.Normal
                            ? undefined
                            : {
                                  timestamp: row.creationTimestamp,
                                  location: {
                                      lat: row.location.x,
                                      lon: row.location.y,
                                  },
                              },
                }));
                return {
                    accessType: headUserDetails.access_type,
                    state: headUserDetails.self_perception,
                    userDetails,
                    devices,
                };
            });
        },
    );

export const getEmergencyConnections = async (username: string, database: DBClient) =>
    withDB(database).then(
        async (d: DBClientWithConnection): Promise<NotificationRecipient[]> => {
            const emergencyConnections = await d.connection.query(
                `
                SELECT users.username, users.email
                FROM users_followers uf
                INNER JOIN users on uf.username_follower = users.username
                WHERE uf.username = $1 AND uf.is_emergency_contact = true
                `,
                [username],
            );
            const recipients: NotificationRecipient[] = emergencyConnections.rows.map(
                (connection) => {
                    return {
                        email: connection.email,
                        username: connection.username,
                    };
                },
            );

            return recipients;
        },
    );
