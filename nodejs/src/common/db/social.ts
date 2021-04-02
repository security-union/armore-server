import { DBClientWithConnection } from "../types";


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
