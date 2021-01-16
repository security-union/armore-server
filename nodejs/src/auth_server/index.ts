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

import { Server } from "http";
import { Request, Response, request } from "express";
import * as core from "express-serve-static-core";
import { ClientConfig } from "pg";
import uuid from "uuid";
import { check, validationResult, param } from "express-validator";

import { Service } from "../common/service";
import router from "../common/router";
import { RabbitClient, QueueOptions } from "../common/rabbit-helpers";
import { logger } from "../common/logger";
import { WEB_URL, VERIFICATION_EMAIL_TEMPLATE } from "../common/constants";

import { DBClient, withSerializableTransaction } from "../common/db/db";
import { StorageOptions, StorageClient } from "../common/storage";
import {
    registerWithEmail,
    registerWithPhone,
    getUserDetails,
    registerDevice,
    registerPublicKey,
    updateUserLanguage,
    userWithPhoneExists,
    userWithEmailExists,
    createEmailVerificationRequest,
    createSmsVerificationRequest,
    getUsername,
    validateVerificationRequest,
    updateProfileImage,
    updateUserDetails,
} from "../common/db/authentication";
import {
    deleteDevice,
    deletePreviousDevices,
    unassociateDeviceFromOtherUsers,
} from "../common/db/device-management";
import {
    createError,
    getPhoneE164,
    getSanitizedPhone,
    getSantizedEmailOrPhone,
    isBase64,
    isEmail,
    ValidationError2,
} from "../common/sanitizer";
import {
    notificationsExchange,
    NOTIFICATIONS_ROUTING_KEY,
    NOTIFICATIONS_SERVER_DELIVERY_OPTIONS_EXPIRE_15_MINUTES,
} from "../common/rabbit-constants";
import { IncomingWebhook } from "@slack/webhook";
import { Trans } from "../common/localization/translation";
import { withErrorBoundary } from "../common/localization/error-boundary";
import {
    ACCEPT_LANGUAGE_HTTP_HEADER,
    translate,
    LocalizableError,
} from "../common/localization/localization";
import { auth } from "../common/authentication";
import { inRange } from "lodash";

const queueOptions: QueueOptions = {
    name: "auth.producer",
};

export class AuthServer implements Service {
    readonly rabbit: RabbitClient;
    readonly httpServer: Server;
    readonly router: core.Express;
    readonly jwtAlgorithm: string;
    readonly pgClient: DBClient;
    storage: StorageClient;

    constructor(
        httpPort: number,
        rabbitMQUrl: string,
        jwtAlgorithm: string,
        pgConfig: ClientConfig,
        storageConfig: StorageOptions,
    ) {
        // 1. Setup RPC Client using RabbitMQ.
        this.rabbit = new RabbitClient(rabbitMQUrl, [notificationsExchange], queueOptions);
        this.router = router();
        this.jwtAlgorithm = jwtAlgorithm;

        // 2. Setup HTTP Server.
        this.httpServer = this.router.listen(httpPort, () => {
            logger.info(`Started AuthServer on port ${httpPort}
            in ${this.router.get("env")} mode`);
        });

        // 3. Configure DB Client.
        this.pgClient = new DBClient(pgConfig);

        // 4. Configure storage
        this.storage = new StorageClient(storageConfig);
    }

    start = async (): Promise<void> => {
        await this.pgClient.connect();
        await this.rabbit.start();
        this.router.post(
            "/login",
            [check("publicKey").isLength({ min: 3, max: 4000 }).trim()],
            this.onLogin,
        );

        this.router.post(
            "/register",
            [
                check("username").isLength({ min: 3, max: 255 }).trim(),
                check("firstName").isLength({ min: 3, max: 255 }).trim(),
                check("lastName").isLength({ min: 3, max: 255 }).trim(),
                check("publicKey").isLength({ min: 3, max: 4000 }).trim(),
            ],
            this.register,
        );
        this.router.get("/me", this.me);

        this.router.patch("/me", this.updateProfile);
        this.router.put("/me", this.updateProfile);

        this.router.delete(
            "/me/devices/:deviceId",
            [param("deviceId").isLength({ min: 3, max: 255 }).trim()],
            this.deleteDevice,
        );
        this.router.get(
            "/user/exists/email/:email",
            [param("email").isLength({ min: 3, max: 255 }).trim().isEmail()],
            this.userWithEmailExists,
        );
        this.router.get(
            "/user/exists/:email",
            [param("email").isLength({ min: 3, max: 255 }).trim().isEmail()],
            this.userWithEmailExists,
        );
        this.router.get(
            "/user/exists/phone/:phone",
            [param("phone").isLength({ min: 3, max: 255 }).trim()],
            this.userWithPhoneExists,
        );
        this.router.post(
            "/user/verify/:emailOrPhone",
            [
                param("emailOrPhone").isLength({ min: 3, max: 255 }).trim(),
                check("publicKey").isLength({ min: 3, max: 4000 }).trim(),
                check("code").isLength({ min: 3, max: 44 }).trim(),
                check("deviceId").isLength({ min: 3, max: 100 }).trim(),
                check("os").isLength({ min: 3, max: 100 }).trim(),
                check("osVersion").isLength({ min: 2, max: 100 }).trim(),
                check("model").isLength({ min: 3, max: 100 }).trim(),
                check("deletePreviousDevice").isBoolean(),
            ],
            this.verifyCode,
        );
    };

    stop = async () => {
        this.httpServer.close();
        await this.rabbit.close();
        await this.pgClient.end();
    };

    onLogin = async (req: Request, res: Response) =>
        withErrorBoundary(req, res, async () => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw createError(errors, req);
            }
            const publicKey = req.body.publicKey;

            if (req.body.email) {
                const email = req.body.email.toLowerCase();
                await this.createAndSendVerificationEmail(email, publicKey, req);
            } else if (req.body.phoneNumber) {
                const sanitizedPhoneNumber = getPhoneE164(req.body.phoneNumber, req);
                await this.createAndSendVerificationSms(sanitizedPhoneNumber, publicKey, req);
            } else {
                throw new LocalizableError(
                    Trans.BadRequest,
                    402,
                    "Invalid body on login. email and phone number were both null.",
                );
            }

            res.status(200).send({
                success: true,
                result: {
                    message: translate(Trans.VerificationCreatedSuccessfully, req),
                },
            });
        });

    me = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const langHeaderValue = req.get(ACCEPT_LANGUAGE_HTTP_HEADER);
                // @ts-ignore
                const language: string = langHeaderValue ? langHeaderValue : "en";
                const userDetails = await getUserDetails({ username }, this.pgClient);
                if (userDetails.language !== language) {
                    await updateUserLanguage({ username, language }, this.pgClient);
                    userDetails.language = language;
                }
                const result = {
                    success: true,
                    result: userDetails,
                };
                res.status(200).send(result);
            }),
        );

    updateProfile = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }

                if (req.body.constructor === Object && Object.keys(req.body).length === 0) {
                    throw new LocalizableError(Trans.BadRequest, 400, "Nothing to update");
                }

                const { email, firstName, lastName, picture } = req.body;
                let sanitizedPhoneNumber = undefined;

                // Validation
                if (req.body.phoneNumber) {
                    sanitizedPhoneNumber = getPhoneE164(req.body.phoneNumber, req);
                }

                if (email) {
                    if (!isEmail(email)) {
                        throw new ValidationError2("Email is not in a valid format");
                    }
                }

                if (firstName) {
                    if (!inRange(firstName.length, 3, 255)) {
                        throw new ValidationError2(
                            "First name must be between 3 and 255 characters.",
                        );
                    }
                }

                if (lastName) {
                    if (!inRange(lastName.length, 3, 255)) {
                        throw new ValidationError2(
                            "Last name must be between 3 and 255 characters.",
                        );
                    }
                }

                if (picture) {
                    if (!isBase64(picture)) {
                        throw new ValidationError2("Picture must be in base64 format.");
                    }
                    const imageName: string = uuid.v4();
                    await this.storage.storeImage(picture, imageName);
                    await updateProfileImage({ username }, imageName, this.pgClient);
                }

                await updateUserDetails(
                    { username },
                    email,
                    firstName,
                    lastName,
                    sanitizedPhoneNumber,
                    this.pgClient,
                );
                const userDetails = await getUserDetails({ username }, this.pgClient);
                res.status(200).send({
                    success: true,
                    result: {
                        ...userDetails,
                    },
                });
            }),
        );

    deleteDevice = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }
                const { deviceId } = req.params;
                await withSerializableTransaction(this.pgClient, async (connection) => {
                    await deleteDevice({ username, deviceId }, connection);
                    res.status(200).send({
                        success: true,
                        result: {
                            message: translate(Trans.DeleteDeviceSuccess, req),
                        },
                    });
                });
            }),
        );

    register = async (req: Request, res: Response) =>
        withErrorBoundary(req, res, async () => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw createError(errors, req);
            }

            const username = req.body.username.toLowerCase();
            const firstName = req.body.firstName;
            const lastName = req.body.lastName;
            const picture = req.body.picture;
            const publicKey = req.body.publicKey;

            const langHeaderValue = req.header(ACCEPT_LANGUAGE_HTTP_HEADER);
            const language: string = langHeaderValue ? langHeaderValue : "en";

            const imageName: string = uuid.v4();
            if (picture !== undefined) {
                await this.storage.storeImage(picture, imageName);
            }

            const sendSlackMessage = async (message: string) => {
                try {
                    const url = process.env.BETA_SIGNUP_SLACK_WEBHOOK_URL;
                    if (!url) {
                        logger.error(`Webhook url is missing from env`);
                    }
                    const webhook = new IncomingWebhook(url!);
                    await webhook.send({
                        text: message,
                    });
                } catch (e) {
                    logger.error(e);
                }
            };

            if (req.body.email) {
                const email = req.body.email.toLowerCase().trim();
                if (!isEmail(email)) {
                    throw new ValidationError2("Email is not in a valid format");
                }

                await withSerializableTransaction(this.pgClient, async (connection) => {
                    await registerWithEmail(
                        {
                            username,
                            email,
                            firstName,
                            lastName,
                            picture: picture !== undefined ? imageName : undefined,
                            publicKey,
                            language,
                        },
                        connection,
                    );
                    await this.createAndSendVerificationEmail(email, publicKey, req);
                });
                sendSlackMessage(`User registered username: ${username} email: ${email}`);
            } else if (req.body.phoneNumber) {
                const sanitizedPhoneNumber = getPhoneE164(req.body.phoneNumber, req);
                await withSerializableTransaction(this.pgClient, async (connection) => {
                    await registerWithPhone(
                        {
                            username,
                            phoneNumber: sanitizedPhoneNumber,
                            firstName,
                            lastName,
                            picture: picture !== undefined ? imageName : undefined,
                            publicKey,
                            language,
                        },
                        connection,
                    );
                    await this.createAndSendVerificationSms(sanitizedPhoneNumber, publicKey, req);
                });
                sendSlackMessage(
                    `User registered username: ${username} phone: ${sanitizedPhoneNumber}`,
                );
            } else {
                throw new LocalizableError(
                    Trans.BadRequest,
                    402,
                    "Invalid body on login. email and phone number were both null.",
                );
            }

            res.status(200).send({
                success: true,
                result: {
                    message: translate(Trans.VerificationCreatedSuccessfully, req),
                },
            });
        });

    userWithEmailExists = async (req: Request, res: Response) =>
        withErrorBoundary(req, res, async () => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw createError(errors, req);
            }
            const { email } = req.params;
            const exists = {
                exists: await userWithEmailExists(email.toLowerCase(), this.pgClient),
            };
            const result = {
                success: true,
                result: exists,
            };
            if (exists.exists) {
                res.status(200).send(result);
            } else {
                res.status(201).send(result);
            }
        });

    userWithPhoneExists = async (req: Request, res: Response) =>
        withErrorBoundary(req, res, async () => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw createError(errors, req);
            }
            const sanitizedPhone = getSanitizedPhone(req.params.phone, req);
            const exists = {
                exists: await userWithPhoneExists(sanitizedPhone, this.pgClient),
            };
            const result = {
                success: true,
                result: exists,
            };
            if (exists.exists) {
                res.status(200).send(result);
            } else {
                res.status(201).send(result);
            }
        });

    verifyCode = async (req: Request, res: Response) =>
        withErrorBoundary(req, res, async () => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw createError(errors, req);
            }
            const sanitizedEmailOrPhone = getSantizedEmailOrPhone(req.params.emailOrPhone, req);
            const {
                deviceId,
                os,
                osVersion,
                appVersion,
                model,
                code,
                publicKey,
                deletePreviousDevice,
            } = req.body;
            const userDetails = await withSerializableTransaction(this.pgClient, async (cc) => {
                const validated = await validateVerificationRequest(
                    sanitizedEmailOrPhone,
                    code,
                    this.pgClient,
                );
                if (!validated) {
                    throw new LocalizableError(
                        Trans.VerificationFailure,
                        401,
                        "verification failure",
                    );
                }
                const { username } = await getUsername(sanitizedEmailOrPhone, this.pgClient);
                if (deletePreviousDevice) {
                    await deletePreviousDevices({ username }, this.pgClient);
                    await unassociateDeviceFromOtherUsers({ deviceId }, this.pgClient);
                }
                await registerDevice(
                    { username, deviceId, os, osVersion, appVersion, model },
                    this.pgClient,
                );
                await registerPublicKey({ username, publicKey }, cc);
                return await getUserDetails({ username }, this.pgClient);
            });

            res.status(200).send({
                success: true,
                result: {
                    ...userDetails,
                },
            });
        });

    createAndSendVerificationEmail = async (email: string, publicKey: string, req: Request) => {
        const username = await getUsername(email, this.pgClient);
        if (!username) {
            throw new LocalizableError(Trans.BadRequest, 400, "Username does not exist");
        }
        const userDetails = await getUserDetails(username, this.pgClient);
        const { verificationId, verificationCode } = await createEmailVerificationRequest(
            email,
            publicKey,
            this.pgClient,
        );
        const title = translate(Trans.VerificationEmailTitle, req);
        if (verificationId !== undefined) {
            this.rabbit.sendMessage({
                message: JSON.stringify([
                    {
                        email,
                        templateId: VERIFICATION_EMAIL_TEMPLATE,
                        subject: `Armore: ${title}`,
                        dynamicTemplateData: {
                            title,
                            body: translate(
                                Trans.VerificationEmailBody,
                                req,
                                userDetails.firstName,
                            ),
                            linkTitle: translate(Trans.VerificationEmailButtonText, req),
                            code: verificationCode,
                            link: `${WEB_URL}/user/verify/${verificationCode}`,
                        },
                    },
                ]),
                routingKey: NOTIFICATIONS_ROUTING_KEY,
                exchange: notificationsExchange.name,
                options: NOTIFICATIONS_SERVER_DELIVERY_OPTIONS_EXPIRE_15_MINUTES,
            });
        } else {
            throw new LocalizableError(
                Trans.InternalServerError,
                501,
                "Unable to create verification request",
            );
        }
    };

    createAndSendVerificationSms = async (phoneNumber: string, publicKey: string, req: Request) => {
        const { verificationId, verificationCode } = await createSmsVerificationRequest(
            phoneNumber,
            publicKey,
            this.pgClient,
        );
        if (verificationId !== undefined) {
            const sms = {
                to: phoneNumber,
                body: translate(
                    Trans.SmsVerificationBody,
                    req,
                    verificationCode,
                    `${WEB_URL}/user/verify/${verificationCode}`,
                ),
            };
            this.rabbit.sendMessage({
                message: JSON.stringify([sms]),
                routingKey: NOTIFICATIONS_ROUTING_KEY,
                exchange: notificationsExchange.name,
                options: NOTIFICATIONS_SERVER_DELIVERY_OPTIONS_EXPIRE_15_MINUTES,
            });
        } else {
            throw new LocalizableError(
                Trans.InternalServerError,
                501,
                "Unable to create verification request",
            );
        }
    };
}
