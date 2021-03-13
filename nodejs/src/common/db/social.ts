import { DBClient, withDB } from "./db";
import {
    AccessType,
    DBClientWithConnection,
    Device,
    UserDetails,
    UserState,
} from "../types";

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

