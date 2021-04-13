/**
 * Copyright [2018] [Dario Alessandro Lencina Talarico]
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
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
    DBClientWithConnection,
    GetGeofencesResponse,
    Username,
    CreateGeofence,
    SubscribeGeofence,
    DeleteGeofence,
    Geofence,
} from "../types";

import { mapGeofencesToJSON } from "./db-transformers";
import { LocalizableError } from "../localization/localization";
import { Trans } from "../localization/translation";

export const getGeofences = async ({ username }: Username, database: DBClient) =>
    withDB(database).then(
        async (c: DBClientWithConnection): Promise<GetGeofencesResponse> => {
            const mine = await c.connection.query(
                "SELECT g.geofence_id, g.username, g.lat, g.lon, " +
                    "g.radius, g.name, g.address " +
                    "FROM geofences g " +
                    "WHERE g.username = $1",
                [username],
            );
            const subscribed = await c.connection.query(
                "SELECT g.geofence_id, g.username, g.lat, g.lon, " +
                    "g.radius, g.name, g.address " +
                    "FROM geofences g " +
                    "JOIN users_geofences ug " +
                    "ON g.geofence_id = ug.geofence_id " +
                    "WHERE ug.username = $1",
                [username],
            );
            const unsubscribed = await c.connection.query(
                "SELECT g.geofence_id, g.username, g.lat, g.lon, " +
                    "g.radius, g.name, g.address " +
                    "FROM geofences g " +
                    "JOIN users_followers uf " +
                    "ON g.username = uf.username " +
                    "WHERE uf.username_follower = $1",
                [username],
            );

            const active = await c.connection.query(
                "SELECT geofence_id " + "FROM device_geofence " + "WHERE active = true",
            );

            const activeGeofences = active.rows.map((v) => v.get("geofence_id"));

            const result = mapGeofencesToJSON({ mine, subscribed, unsubscribed, activeGeofences });

            // Filter already subscribed geofences
            result.unsubscribed = result.unsubscribed.reduce(function (
                accumulator: Geofence[],
                notSubbed,
            ) {
                result.subscribed.forEach((subbed) => {
                    if (JSON.stringify(subbed) !== JSON.stringify(notSubbed)) {
                        accumulator.push(notSubbed);
                    }
                });
                return accumulator;
            },
            []);

            return result;
        },
    );

export const createGeofence = async (
    username: String,
    geofence: CreateGeofence,
    database: DBClient,
) =>
    withDB(database).then(async (c: DBClientWithConnection) => {
        if (username !== geofence.username) {
            const followers = await getFollowersByUsername(username, database);
            if (followers.indexOf(geofence.username) === -1) {
                throw new LocalizableError(Trans.UnableToCreateGeofence, 501);
            }
        }

        const result = await c.connection.query(
            "INSERT INTO geofences (address, lat, lon, radius, name, username) " +
                "VALUES ($1, $2, $3, $4, $5, $6) " +
                "RETURNING geofence_id",
            [
                geofence.address,
                geofence.lat,
                geofence.lon,
                geofence.radius,
                geofence.name,
                geofence.username,
            ],
        );

        if (result.rowCount !== 1) {
            throw new LocalizableError(Trans.UnableToCreateGeofence, 501);
        }

        return result.rows[0].geofence_id;
    });

export const deleteGeofence = async ({ geofenceId, owner }: DeleteGeofence, database: DBClient) =>
    withDB(database).then(async (c: DBClientWithConnection) => {
        const result = await c.connection.query(
            "DELETE FROM geofences g " + "WHERE g.geofence_id = $1 AND g.username = $2",
            [geofenceId, owner],
        );
        return result.rowCount === 1;
    });

export const unsubscribeFromGeofence = async (
    { geofenceId, subscriber }: SubscribeGeofence,
    database: DBClient,
) =>
    withDB(database).then(async (c: DBClientWithConnection) => {
        const result = await c.connection.query(
            "DELETE FROM users_geofences ug " + "WHERE ug.geofence_id = $1 AND ug.username = $2",
            [geofenceId, subscriber],
        );
        return result.rowCount === 1;
    });

export const subscribeToGeofence = async (
    { geofenceId, subscriber }: SubscribeGeofence,
    database: DBClient,
) =>
    withDB(database).then(async (c: DBClientWithConnection) => {
        const followers = await getFollowersByGeofenceId(geofenceId, database);
        if (followers.indexOf(subscriber) !== -1) {
            await c.connection.query(
                "INSERT INTO users_geofences (geofence_id, username) " + "VALUES ($1, $2)",
                [geofenceId, subscriber],
            );
        } else {
            throw new LocalizableError(Trans.UnableToSubscribeToGeofence, 401);
        }
    });

const getFollowersByGeofenceId = async (geofenceId: String, database: DBClient) =>
    withDB(database).then(async (c: DBClientWithConnection) => {
        const result = await c.connection.query(
            "SELECT uf.username_follower " +
                "FROM users_followers uf " +
                "JOIN geofences g " +
                "ON g.username = uf.username " +
                "WHERE g.geofence_id = $1",
            [geofenceId],
        );

        const followers: String[] = [];

        result.rows.map((follower) => followers.push(follower.username_follower));

        return followers;
    });

const getFollowersByUsername = async (username: String, database: DBClient) =>
    withDB(database).then(async (c: DBClientWithConnection) => {
        const result = await c.connection.query(
            "SELECT uf.username_follower " + "FROM users_followers uf " + "WHERE uf.username = $1",
            [username],
        );

        const followers: String[] = [];

        result.rows.map((follower) => followers.push(follower.username_follower));

        return followers;
    });
