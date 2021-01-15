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

import { DBClientWithConnection, GetHistoricalLocationRequest, UserState } from "../types";
import { DBClient, withDB } from "./db";
import { getUserDetails } from "./authentication";
import { LocalizableError } from "../localization/localization";
import { Trans } from "../localization/translation";

export const getHistoricalTelemetry = (
    { startTime, endTime, following, username }: GetHistoricalLocationRequest,
    database: DBClient,
): Promise<any> =>
    withDB(database).then(async (d: DBClientWithConnection) => {
        // 1. Verify that username follows follower.
        const result = await d.connection.query(
            `
            SELECT username, username_follower, access_type FROM users_followers
            WHERE username = $1 AND username_follower = $2
            `,
            [following, username],
        );
        if (result.rowCount === 0) {
            throw new LocalizableError(
                Trans.UserIsNotBeingFollowed,
                401,
                `${username} does not follow ${following}`,
                username,
                following,
            );
        }

        // 2. Verify that follower is on emergency state.
        const userDetails = await getUserDetails({ username: following }, database);
        if (userDetails.userState.selfPerceptionState !== UserState.Emergency) {
            throw new LocalizableError(
                Trans.UserIsNotInAnEmergency,
                401,
                `User is not in an emergency, ${following}`,
                following,
            );
        }

        // 3. Query all devices location given the time frame that was provided.
        const locations = await d.connection.query(
            "SELECT encrypted_location, device_id, creation_timestamp AS timestamp " +
                "FROM device_telemetry WHERE username = $1 AND recipient_username = $4" +
                "AND creation_timestamp > $2 AND creation_timestamp < $3 " +
                "ORDER BY timestamp ASC",
            [following, startTime, endTime, username],
        );

        // 4. Transform it and return it.
        return locations.rows.map((row) => ({
            data: row.encrypted_location,
            deviceId: row.device_id,
            timestamp: row.timestamp,
        }));
    });
