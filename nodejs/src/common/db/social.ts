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
