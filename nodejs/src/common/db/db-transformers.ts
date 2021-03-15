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

import { QueryResult } from "pg";
import { GetGeofencesResponse, Geofence } from "../types";

export const mapDBDeviceToJSON = (r: any) => ({
    deviceId: r.device_id,
    role: r.role,
    name: r.name,
    os: r.os,
    model: r.model,
    osVersion: r.os_version,
});

export const mapDBUserToJSON = (r: any) => ({
    email: r.email ? r.email : undefined,
    phoneNumber: r.phone_number ? r.phone_number : undefined,
    firstName: r.first_name,
    lastName: r.last_name,
    picture: r.picture,
    username: r.username,
});

export const mapDBDevicesToJSON = ({ result }: { result: QueryResult }) => {
    return result.rows.map(mapDBDeviceToJSON);
};

export const mapSharedDevicesToJSON = ({
    result,
    owners,
}: {
    result: QueryResult;
    owners: any;
}) => {
    return result.rows.map((r) => ({
        device: mapDBDeviceToJSON(r),
        owner: owners[r.device_id],
        calendarAccess: r.permissions.calendarAccess,
        permanentAccess: r.permissions.permanentAccess,
    }));
};

export const mapGeofenceToJSON = (row: any, state: Boolean): Geofence => ({
    active: state,
    address: row.address,
    username: row.username,
    id: row.geofence_id,
    lat: row.lat,
    lon: row.lon,
    name: row.name,
    radius: row.radius,
});

export const mapGeofencesToJSON = ({
    mine,
    subscribed,
    unsubscribed,
    activeGeofences,
}: {
    mine: QueryResult;
    subscribed: QueryResult;
    unsubscribed: QueryResult;
    activeGeofences: String[];
}): GetGeofencesResponse => {
    return {
        mine: mine.rows.map((row) =>
            mapGeofenceToJSON(row, activeGeofences.indexOf(row.geofence_id) !== -1),
        ),
        subscribed: subscribed.rows.map((row) =>
            mapGeofenceToJSON(row, activeGeofences.indexOf(row.geofence_id) !== -1),
        ),
        unsubscribed: unsubscribed.rows.map((row) =>
            mapGeofenceToJSON(row, activeGeofences.indexOf(row.geofence_id) !== -1),
        ),
    };
};
