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
import http from "http";
import { Request, Response } from "express";
import { partition } from "lodash";
import sgMail from "@sendgrid/mail";
import { MailData } from "@sendgrid/helpers/classes/mail";

import { Server } from "http";
import * as core from "express-serve-static-core";
import { ClientConfig } from "pg";
import PushNotifications from "node-pushnotifications";
import amqp from "amqplib";
import { check, validationResult } from "express-validator";
import { Twilio } from "twilio";

import { DBClient } from "../common/db/db";
import { Service } from "../common/service";
import {
    IOS_BUNDLES,
    IOS_PLATFORM,
    SENDGRID_API_KEY,
    PUSH_NOTIFICATIONS_TOKEN_ANDROID,
    PUSH_NOTIFICATIONS_TOKEN_IOS,
    PUSH_NOTIFICATIONS_TOKEN_KEY_ID_IOS,
    PUSH_NOTIFICATIONS_TOKEN_TEAM_ID_IOS,
    EMAIL_SENDER,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_NUMBER,
    LABS_MOBILE_PASSWORD,
    LABS_MOBILE_USERNAME
} from "../common/constants";
import router from "../common/router";
import { logger } from "../common/logger";
import { authWithDeviceId } from "../common/authentication";
import {
    registerDeviceForPushNotifications,
    getPushNotificationTokensForDevices,
    getEmailAndFullName,
} from "../common/db/device-management";
import { createError } from "../common/sanitizer";
import { RabbitClient, QueueOptions } from "../common/rabbit-helpers";
import { notificationsExchange } from "../common/rabbit-constants";
import { withErrorBoundary } from "../common/localization/error-boundary";
import phone from "phone";

interface PushNotificationsRequest {
    deviceId: string;
    data: PushNotifications.Data;
}

interface SmsRequest {
    body: string;
    to: string;
}

interface MailDataWithUsername {
    username: string | undefined;
    email: string | undefined;
    subject?: string;
    templateId?: string;
    dynamicTemplateData?: { [key: string]: any };
}

export const notificationsServerQueue: QueueOptions = {
    name: "notifications.consumer",
};

export class SMSSender {
    twilio: Twilio;
    labsMobile: LabsMobile;

    PROVIDER_MAP: { [key: string]: string } = {
        "MEX": "labsMobile",
        "COL": "labsMobile",
    }

    constructor() {
        if (LABS_MOBILE_USERNAME !== "" && LABS_MOBILE_PASSWORD !== "") {
            this.labsMobile = new LabsMobile(LABS_MOBILE_USERNAME, LABS_MOBILE_PASSWORD);
        } else {
            throw new Error(
                "Invalid configuration. Must set env vars LABS_MOBILE_USERNAME and LABS_MOBILE_PASSWORD",
            );
        }

        if (TWILIO_ACCOUNT_SID !== "" && TWILIO_AUTH_TOKEN !== "" && TWILIO_NUMBER !== "") {
            this.twilio = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        } else {
            throw new Error(
                "Invalid configuration. Must set env vars TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_NUMBER",
            );
        }
    }

    send = async (smsRequest: SmsRequest[]) => {
        try {
            const [twilioSms, labsMobileSms] = this.mapPhoneNumberToProvider(smsRequest);
            const twilioPromises = twilioSms.flatMap( (sms) => { this._sendTwilio(sms) });
            const labsMobilePromises = labsMobileSms.flatMap( (sms) => { this._sendLabsMobile(sms) });
            const promises = twilioPromises.concat(labsMobilePromises);
            return Promise.allSettled(promises);
        } catch (e) {
            return Promise.reject(e);
        }
    }

    mapPhoneNumberToProvider = (smsRequest: SmsRequest[]): [SmsRequest[], SmsRequest[]] => {
        return partition(smsRequest, (req) => {
            const [_, countryCode] = phone(req.to)     
            if (this.PROVIDER_MAP[countryCode] !== undefined) {
                return false;
            } else {
                return true;
            }
        });
    }

    _sendLabsMobile = async (smsRequest: SmsRequest) => {
        try {
            return this.labsMobile.sendSms(smsRequest);
        } catch (e) {
            return Promise.reject(e);
        }
    };

    _sendTwilio = async (smsRequest: SmsRequest) => {
        try {
            return this.twilio.messages
                .create({ ...smsRequest, from: TWILIO_NUMBER })
                .then((message) => logger.debug("Sent sms sid: ", message.sid))
                .catch((reason) => logger.error("Unable to send sms ", reason));
        } catch (e) {
            return Promise.reject(e);
        }
    };
}

export class LabsMobile {
    username: string;
    password: string;

    constructor(username: string, password: string) {
        this.username = username;
        this.password = password;
    }

    sendSms = async (smsRequest: SmsRequest) => {
        let url = `https://api.labsmobile.com/get/send.php?username=${this.username}&password=${this.password}&message=${smsRequest.body}&msisdn=${smsRequest.to}`
        let res = await http.get(url, (res) => {
            const { statusCode } = res;
            const contentType = res.headers['content-type'];
        });
        return res;
    };
}

export class NotificationServer implements Service {
    readonly rabbit: RabbitClient;
    readonly httpServer: Server;
    router: core.Express;
    pgClient: DBClient;
    push: PushNotifications | undefined;
    smsSender: SMSSender;

    constructor(httpPort: number, rabbitMQUrl: string, pgConfig: ClientConfig) {
        // 1. Setup RPC Client using RabbitMQ.
        this.rabbit = new RabbitClient(
            rabbitMQUrl,
            [notificationsExchange],
            notificationsServerQueue,
        );
        this.router = router();

        if (SENDGRID_API_KEY) {
            sgMail.setApiKey(SENDGRID_API_KEY);
        } else {
            throw new Error("Unable to initialize mail server, please set SENDGRID_API_KEY");
        }

        logger.info(`IOS_BUNDLES ${IOS_BUNDLES.toString()}`);

        // 2. Setup HTTP Server.
        this.httpServer = this.router.listen(httpPort, () => {
            logger.info(
                `Started Notifications Server on port ${httpPort} in ${this.router.get(
                    "env",
                )} mode`,
            );
        });

        // 3. Configure DB Client.
        this.pgClient = new DBClient(pgConfig);

        // 4. Setup SMS Clients
        this.smsSender = new SMSSender();
    }

    configureNotificationsClient = async (
        android: string,
        iOSKeyPath: string,
        iOSKeyId: string,
        iOSTeamId: string,
    ) => {
        const settings: PushNotifications.Settings = {
            gcm: {
                id: android,
            },
            apn: {
                token: {
                    key: iOSKeyPath,
                    keyId: iOSKeyId,
                    teamId: iOSTeamId,
                },
                production: true, // true for APN production environment, false for APN sandbox environment,
            },
        };
        await this.rabbit.consumeFromQueue(async (msg: amqp.Message) => {
            try {
                const jsonArray = JSON.parse(msg.content.toString());
                logger.info(`received notification request ${JSON.stringify(jsonArray)}`);
                const [emails, pushNotifications, smsRequests] = this.sortMessages(jsonArray);
                const emailResults = await this.sendEmails(emails);
                const pushNotificationsResults = await this.sendNotifications(pushNotifications);
                const smsResults = await this.smsSender.send(smsRequests);
                logger.info(`pushNotificationsResults ${JSON.stringify(pushNotificationsResults)}`);
                logger.info(`smsResults ${JSON.stringify(smsResults)}`);
                logger.info(`emailResults ${JSON.stringify(emailResults)}`);
            } catch (e) {
                logger.error(msg.content.toString());
                logger.error(e.message);
            }
            if (this.rabbit.channel) {
                this.rabbit.channel.ack(msg);
            }
        });
        return new PushNotifications(settings);
    };

    sortMessages = (
        jsonArray: any,
    ): [MailDataWithUsername[], PushNotificationsRequest[], SmsRequest[]] => {
        const emails: MailDataWithUsername[] = [];
        const pushNotifications: PushNotificationsRequest[] = [];
        const smsRequests: SmsRequest[] = [];

        jsonArray.forEach((message: any) => {
            if (message["deviceId"] !== undefined) {
                const pushNotification = message as PushNotificationsRequest;
                pushNotifications.push(pushNotification);
            } else if (message["to"] !== undefined) {
                const smsMessage = message as SmsRequest;
                smsRequests.push(smsMessage);
            } else if (message["email"] !== undefined) {
                const email = message as MailDataWithUsername;
                emails.push(email);
            }
        });

        return [emails, pushNotifications, smsRequests];
    };

    start = async (): Promise<void> => {
        await this.pgClient.connect();
        await this.rabbit.start();
        this.router.post(
            "/register",
            [check("pushToken").isLength({ min: 3 }).trim().isString()],
            this.registerDeviceForPushNotifications,
        );

        if (
            PUSH_NOTIFICATIONS_TOKEN_ANDROID &&
            PUSH_NOTIFICATIONS_TOKEN_IOS &&
            PUSH_NOTIFICATIONS_TOKEN_KEY_ID_IOS &&
            PUSH_NOTIFICATIONS_TOKEN_TEAM_ID_IOS
        ) {
            // configure server
            this.push = await this.configureNotificationsClient(
                PUSH_NOTIFICATIONS_TOKEN_ANDROID,
                PUSH_NOTIFICATIONS_TOKEN_IOS,
                PUSH_NOTIFICATIONS_TOKEN_KEY_ID_IOS,
                PUSH_NOTIFICATIONS_TOKEN_TEAM_ID_IOS,
            );
        } else {
            throw new Error(
                "Unable to read PUSH_NOTIFICATIONS_TOKEN_ANDROID or PUSH_NOTIFICATIONS_TOKEN_IOS",
            );
        }
    };

    stop = async () => {
        this.httpServer.close();
        await this.rabbit.close();
        await this.pgClient.end();
    };

    registerDeviceForPushNotifications = async (req: Request, res: Response) =>
        authWithDeviceId(req, res, this.pgClient, async ({ username, deviceId }) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }
                const pushToken = req.body.pushToken;

                await registerDeviceForPushNotifications(
                    {
                        username,
                        deviceId,
                        pushToken,
                    },
                    this.pgClient,
                );
                res.status(200).send({
                    success: true,
                    result: { message: "Everything is awesome" },
                });
            }),
        );

    sendEmails = async (msgs: MailDataWithUsername[]) => {
        // fetch emails
        const usernames: (string | undefined)[] = msgs
            .map(({ username }) => username)
            .filter(Boolean);

        const userInfo = await getEmailAndFullName(usernames, this.pgClient);
        // populate msg with the emails.
        const emailsToSend: MailData[] = msgs.map((msg: MailDataWithUsername) => {
            const user = msg.username ? userInfo[msg.username] : undefined;
            return {
                to: user ? user.email : msg.email,
                from: EMAIL_SENDER,
                name: user ? `${user.firstName} ${user.lastName}` : undefined,
                subject: msg.subject ? msg.subject : "Armore: location sharing",
                ...msg,
            };
        });
        logger.info(`emails ${JSON.stringify(emailsToSend)}`);
        return Promise.allSettled(emailsToSend.map((m) => sgMail.send(m)));
    };

    sendNotifications = async (notificationRequests: PushNotificationsRequest[]) => {
        const { push } = this;
        const deviceIds = notificationRequests.map(
            (notificationRequest) => notificationRequest.deviceId,
        );
        try {
            const tokens = await getPushNotificationTokensForDevices(deviceIds, this.pgClient);
            return Promise.allSettled(
                notificationRequests.flatMap(({ deviceId, data }) => {
                    const { pushToken, os } = tokens[deviceId];
                    if (!pushToken) {
                        return Promise.reject(`error retrieving token for device ${deviceId}`);
                    } else if (push) {
                        // If iOS, send 1 notification per bundle:
                        return os === IOS_PLATFORM
                            ? IOS_BUNDLES.map((topic) => ({ ...data, topic })).flatMap((payload) =>
                                  push.send(pushToken, payload),
                              )
                            : push.send(pushToken, data);
                    } else {
                        return Promise.reject("There's no push notifications client");
                    }
                }),
            );
        } catch (e) {
            return Promise.reject(e);
        }
    };
}
