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
 * Function used to read the specified env var named varName and cast it to integer.
 *
 * If the variable is not defined, then defaultValue is used.
 * @param varName
 * @param defaultValue
 */
const getIntOrDefault = (varName: string, defaultValue: number): number => {
    const value = process.env[varName];
    return value ? parseInt(value) : defaultValue;
};

const getBooleanOrDefault = (varName: string, defaultValue: boolean): boolean => {
    const value = process.env[varName];
    return value ? value === "true" : defaultValue;
};

/**
 * All env variables must be defined in this file.
 */

export const HTTP_GATEWAY_PORT: number = getIntOrDefault("HTTP_GATEWAY_PORT", 8081);
export const WS_GATEWAY_PORT: number = getIntOrDefault("WS_GATEWAY_PORT", 9080);
export const AUTH_SERVER: number = getIntOrDefault("AUTH_SERVER", 10000);
export const NOTIFICATION_SERVER_PORT: number = getIntOrDefault("NOTIFICATION_SERVER_PORT", 9999);

export const WEB_URL = process.env.WEB_URL || "https://armore.dev";

export const RABBIT_MQ_HOST = process.env.RABBIT_MQ_HOST || "rabbit";

export const RABBITMQ_USER = process.env.RABBITMQ_USER || "rabbitmq";
export const RABBITMQ_PASS = process.env.RABBITMQ_PASS || "rabbitmq";

export const RABBITMQ_VHOST = process.env.RABBITMQ_VHOST;

export const RABBIT_MQ_URL_WITH_CREDS = () =>
    `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBIT_MQ_HOST}/${RABBITMQ_VHOST}`;

export const JWT_CUSTOMER_ALGORITHM = "RS512";
export const JWT_HEADER_TOKEN = "asimovlives";
// ** SECURITY **

/**
 * PostgreSQL
 */

export const PG_USER = process.env.PG_USER || "postgres";
export const PG_PASS = process.env.PG_PASS || "docker";
export const PG_HOST = process.env.PG_HOST || "postgres";
export const PG_PORT = getIntOrDefault("PG_PORT", 5432);
export const PG_DB = process.env.PG_DB || "garage";
export const PG_URL =
    process.env.PG_URL || "postgres://postgres:docker@postgres:5432/rescuelink?sslmode=disable";

/**
 * Mail
 */

export const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
export const MAIL_ENABLED = getBooleanOrDefault("MAIL_ENABLED", false);
export const EMAIL_SENDER = {
    email: "notifications@armore.dev",
    name: "Armore Notifications",
};
export const VERIFICATION_EMAIL_TEMPLATE = "d-fac72b3d96894b5bb5a0f5944102f891";
export const GENERIC_EMAIL_TEMPLATE = "d-f4c36d6358cd445e9a873e103c3efe05";

/**
 * Redis
 */

export const REDIS_HOST = process.env.REDIS_HOST || "redis";
export const REDIS_PORT = getIntOrDefault("REDIS_PORT", 6379);

/**
 * Cloud Storage
 */

export const CS_TYPE = process.env.CS_TYPE || "local-development";
export const CS_BUCKET = process.env.CS_BUCKET || "rescuelink_user_pictures";
export const CS_PATH = process.env.CS_PATH || "/app/images";
export const CS_CREDENTIALS_FILE =
    process.env.CS_CREDENTIALS_FILE || "/secrets/cloudsql/credentials.json";
export const CS_PROJECT = process.env.CS_PROJECT || "REPLACE ME";
export const CS_PROFILE_IMAGE_PATH = "https://storage.cloud.google.com/rescuelink_user_pictures";

/**
 * Push Notifications tokens
 */
export const PUSH_NOTIFICATIONS_TOKEN_ANDROID = process.env.PUSH_NOTIFICATIONS_TOKEN_ANDROID;
export const PUSH_NOTIFICATIONS_TOKEN_IOS = process.env.PUSH_NOTIFICATIONS_TOKEN_IOS;
export const PUSH_NOTIFICATIONS_TOKEN_KEY_ID_IOS = process.env.PUSH_NOTIFICATIONS_TOKEN_KEY_ID_IOS;
export const PUSH_NOTIFICATIONS_TOKEN_TEAM_ID_IOS =
    process.env.PUSH_NOTIFICATIONS_TOKEN_TEAM_ID_IOS;

export const IOS_BUNDLES = ["com.armore.SecurityUnion"];
export const IOS_PLATFORM = "iOS";

/**
 * Max number of followers allowed by the system.
 */
export const MAX_FOLLOWERS = 10;

/**
 * Twilio Account Auth
 */
export const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
export const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
export const TWILIO_NUMBER = process.env.TWILIO_NUMBER || "";

/**
 * App store and Play store links
 */
export const APP_STORE_URL = "https://apps.apple.com/us/app/id1515585896";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.blackfire.android";
