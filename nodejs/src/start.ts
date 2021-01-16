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

/**
 * Script used to start both HTTP and WebSocket Servers.
 */

import { ClientConfig } from "pg";

import {
    RABBIT_MQ_URL_WITH_CREDS,
    HTTP_GATEWAY_PORT,
    WS_GATEWAY_PORT,
    AUTH_SERVER,
    JWT_CUSTOMER_ALGORITHM,
    PG_URL,
    NOTIFICATION_SERVER_PORT,
    REDIS_HOST,
    REDIS_PORT,
    CS_BUCKET,
    CS_PATH,
    CS_TYPE,
    CS_CREDENTIALS_FILE,
    CS_PROJECT,
} from "./common/constants";
import { HTTPGateway } from "./http_gateway";
import { WSGateway } from "./ws_gateway";
import { logger } from "./common/logger";
import { AuthServer } from "./auth_server";
import { NotificationServer } from "./notification_server";
import { RedisConfig } from "./common/tedis-config";
import { StorageOptions } from "./common/storage";

const { SERVICE_NAME } = process.env;

switch (SERVICE_NAME) {
    case "http_gateway":
        (async () => {
            const pgConfig: ClientConfig = {
                keepAlive: true,
                connectionString: PG_URL,
            };

            const redisConfig: RedisConfig = {
                host: REDIS_HOST,
                port: REDIS_PORT,
            };

            const storageConfig: StorageOptions = {
                bucketName: CS_BUCKET,
                localStoragePath: CS_PATH,
                storageType: CS_TYPE,
                cloudStorageCredentials: CS_CREDENTIALS_FILE,
                cloudStorageProject: CS_PROJECT,
            };

            const httpGateway = new HTTPGateway(
                HTTP_GATEWAY_PORT,
                RABBIT_MQ_URL_WITH_CREDS(),
                pgConfig,
                redisConfig,
                storageConfig,
            );
            await httpGateway.start();
            logger.info("HTTPGateway connected");
        })();
        break;
    case "ws_gateway":
        (async () => {
            const pgConfig: ClientConfig = {
                keepAlive: true,
                connectionString: PG_URL,
            };

            const redisConfig: RedisConfig = {
                host: REDIS_HOST,
                port: REDIS_PORT,
            };

            const wsGateway = new WSGateway(
                WS_GATEWAY_PORT,
                RABBIT_MQ_URL_WITH_CREDS(),
                pgConfig,
                redisConfig,
            );
            await wsGateway.start();
            logger.info("WSGateway connected");
        })();
        break;
    case "auth_server":
        (async () => {
            const pgConfig: ClientConfig = {
                keepAlive: true,
                connectionString: PG_URL,
            };

            const storageConfig: StorageOptions = {
                bucketName: CS_BUCKET,
                localStoragePath: CS_PATH,
                storageType: CS_TYPE,
                cloudStorageCredentials: CS_CREDENTIALS_FILE,
                cloudStorageProject: CS_PROJECT,
            };

            const authServer = new AuthServer(
                AUTH_SERVER,
                RABBIT_MQ_URL_WITH_CREDS(),
                JWT_CUSTOMER_ALGORITHM,
                pgConfig,
                storageConfig,
            );
            logger.info("Starting AuthServer");
            await authServer.start();
            logger.info("AuthServer connected");
        })();
        break;
    case "notification_server":
        (async () => {
            const pgConfig: ClientConfig = {
                keepAlive: true,
                connectionString: PG_URL,
            };

            const notificationServer = new NotificationServer(
                NOTIFICATION_SERVER_PORT,
                RABBIT_MQ_URL_WITH_CREDS(),
                pgConfig,
            );
            await notificationServer.start();
            logger.info("NotificationServer connected");
        })();
        break;
    default:
        console.error(`unable to find service ${SERVICE_NAME}`);
}
