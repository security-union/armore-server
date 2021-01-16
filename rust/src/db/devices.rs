/**
 * Copyright [2020] [Griffin Obeid]
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
 use postgres::{NoTls, Row};
 use r2d2::PooledConnection;
 use r2d2_postgres::PostgresConnectionManager;
 
 use super::telemetry::postgres_to_api;
 use crate::model::{APIInternalError, Device};
 use crate::strings::TranslationIds;
 
 fn row_to_device(row: &Row) -> Option<Device> {
     return Option::Some(Device {
         deviceId: row.get("device_id"),
         role: row.get("role"),
         name: row.get("name"),
         lastUpdatedTimestamp: None,
         locationPermissionState: row.get("location_permission_state"),
         isNotificationsEnabled: row.get("is_notifications_enabled"),
         isBackgroundRefreshOn: row.get("is_background_refresh_on"),
         isLocationServicesOn: row.get("is_location_services_on"),
         isPowerSaveModeOn: row.get("is_power_save_mode_on"),
         os: row.get("os"),
         osVersion: row.get("os_version"),
         model: row.get("model"),
         pushToken: row.get("push_token"),
         appVersion: row.get("app_version"),
     });
 }
 
 pub fn get_device_by_id(
     device_id: &str,
     client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
 ) -> Result<Device, APIInternalError> {
     // Select the last row for this device_id
     let latest_device_settings_statement = client
         .prepare(
             "
                 SELECT *
                 FROM devices
                 WHERE device_id = $1
                 ",
         )
         .map_err(postgres_to_api)?;
     match client
         .query(&latest_device_settings_statement, &[&device_id])
         .map_err(postgres_to_api)?
         .iter()
         .fold(None, |_acc, row| row_to_device(row))
     {
         Some(d) => Ok(d),
         None => Err(APIInternalError {
             msg: TranslationIds::DeviceNotFound,
             engineering_error: None,
         }),
     }
 }
 
 pub fn update_device_settings(
     device_update: Device,
     client: &mut PooledConnection<PostgresConnectionManager<NoTls>>,
 ) -> Result<bool, APIInternalError> {
     let insert_statement = client
         .prepare(
             "
             UPDATE devices SET
                 app_version=$2,
                 is_background_refresh_on=$3,
                 is_location_services_on=$4,
                 is_notifications_enabled=$5,
                 is_power_save_mode_on=$6,
                 location_permission_state=$7,
                 model=$8,
                 os=$9,
                 os_version=$10
             WHERE device_id = $1
             RETURNING *
         ",
         )
         .map_err(postgres_to_api)?;
 
     let new_device = client
         .query(
             &insert_statement,
             &[
                 &device_update.deviceId,
                 &device_update.appVersion,
                 &device_update.isBackgroundRefreshOn,
                 &device_update.isLocationServicesOn,
                 &device_update.isNotificationsEnabled,
                 &device_update.isPowerSaveModeOn,
                 &device_update.locationPermissionState,
                 &device_update.model,
                 &device_update.os,
                 &device_update.osVersion,
             ],
         )
         .map_err(postgres_to_api)?
         .iter()
         .fold(None, |_acc, row| row_to_device(row));
 
     match new_device {
         Some(_) => Ok(true),
         None => Err(APIInternalError {
             msg: TranslationIds::DeviceNotUpdated,
             engineering_error: None,
         }),
     }
 }
 