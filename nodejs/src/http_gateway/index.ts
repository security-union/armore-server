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

import { Request, Response } from "express";
import { Server } from "http";
import * as core from "express-serve-static-core";
import { ClientConfig } from "pg";
import { check, param, validationResult, query } from "express-validator";

import { Service } from "../common/service";
import { logger } from "../common/logger";
import router from "../common/router";
import { auth, authWithDeviceId } from "../common/authentication";
import { DBClient, withSerializableTransaction } from "../common/db/db";
import {
    EmailPendingInvitation,
    PhonePendingInvitation,
    EmailInvitationRequest,
    PhoneInvitationRequest,
    FollowerInvitation,
    NotificationRecipient,
    Email,
    PushNotification,
    Notifications,
    UserState,
    Sms,
    UserInfo,
} from "../common/types";
import { RedisConfig } from "../common/tedis-config";
import { InvitationType } from "../common/types";
import { StorageOptions, StorageClient } from "../common/storage";
import { getDevices, updateUserState } from "../common/db/device-management";
import { removeFollower, getEmergencyConnections, changeAccessType } from "../common/db/social";
import { getHistoricalTelemetry } from "../common/db/location";
import {
    getInvitations,
    createInvitation,
    acceptInvitation,
    rejectInvitation,
    cancelInvitation,
    getUserInfo,
    getUserInfoWithEmailOrPhone,
    getAllDevicesForUserWithEmailOrPhone,
} from "../common/db/invitations";
import {
    createGeofence,
    getGeofences,
    subscribeToGeofence,
    unsubscribeFromGeofence,
    deleteGeofence,
} from "../common/db/geofences";
import { createError, getPhoneE164, isEmail } from "../common/sanitizer";
import {
    APP_STORE_URL,
    CS_PROFILE_IMAGE_PATH,
    GENERIC_EMAIL_TEMPLATE,
    PLAY_STORE_URL,
    WEB_URL,
} from "../common/constants";
import { QueueOptions, RabbitClient } from "../common/rabbit-helpers";
import {
    notificationsExchange,
    NOTIFICATIONS_ROUTING_KEY,
    NOTIFICATIONS_SERVER_DELIVERY_OPTIONS_EXPIRE_1_HOUR,
} from "../common/rabbit-constants";
import { getUserDetails } from "../common/db/authentication";
import { INVITATIONS_URL } from "./constants";
import { IncomingWebhook } from "@slack/webhook";
import { withErrorBoundary } from "../common/localization/error-boundary";
import {
    LocalizableError,
    translate,
    translateWithFormat,
} from "../common/localization/localization";
import { Trans } from "../common/localization/translation";

const GET_USERNAME_FROM_EMAIL = /^([a-z\d._%-]+)/;

const httpGatewayQueue: QueueOptions = {
    name: "http.producer",
};

/**
 * HTTP Server that interacts with the mobile apps to send commands to the blackberry PI.
 */

export class HTTPGateway implements Service {
    readonly rabbit: RabbitClient;
    readonly httpServer: Server;
    router: core.Express;
    pgClient: DBClient;
    storage: StorageClient;

    constructor(
        httpPort: number,
        rabbitMQUrl: string,
        pgConfig: ClientConfig,
        redisConfig: RedisConfig,
        storageConfig: StorageOptions,
    ) {
        // 1. Setup RPC Client using RabbitMQ.
        this.rabbit = new RabbitClient(rabbitMQUrl, [notificationsExchange], httpGatewayQueue);
        this.router = router();

        // 2. Setup HTTP Server.
        this.httpServer = this.router.listen(httpPort, () => {
            logger.info(
                `Started HTTPGateway on port ${httpPort} in ${this.router.get("env")} mode`,
            );
        });

        // 3. Configure DB Client.
        this.pgClient = new DBClient(pgConfig);

        // 4. Configure storage
        this.storage = new StorageClient(storageConfig);
    }

    start = async (): Promise<void> => {
        await this.pgClient.connect();
        await this.rabbit.start();

        this.router.get("/devices", this.getDevices);

        this.router.get("/invitations", this.getInvitations);
        this.router.post("/invitations/:id/reject", this.rejectInvitation);
        this.router.post("/invitations/:id/accept", this.acceptInvitation);
        this.router.post("/invitations/:id/cancel", this.cancelInvitation);
        this.router.post("/invitations", this.createInvitation);
        this.router.get("/image/:image", this.getImage);
        this.router.post(
            "/me/state/:newState",
            [param("newState").isLength({ min: 3, max: 255 }).trim().isString()],
            this.updateState,
        );
        this.router.get(
            "/me/connections/following/:username/telemetry",
            [
                param("username").isLength({ min: 3, max: 255 }).trim().isString(),
                query("startTime").isLength({ min: 3, max: 255 }).trim(),
                query("endTime").isLength({ min: 3, max: 255 }).trim(),
            ],
            this.getHistoricalTelemetry,
        );
        this.router.delete(
            "/me/connections/following/:username",
            [param("username").isLength({ min: 3, max: 255 }).trim().isString()],
            this.stopFollowing,
        );
        this.router.delete(
            "/me/connections/followers/:username",
            [param("username").isLength({ min: 3, max: 255 }).trim().isString()],
            this.removeFollower,
        );
        this.router.post(
            "/me/connections/followers/:username/accessType/:accessType",
            [
                param("username").isLength({ min: 3, max: 255 }).trim().isString(),
                param("accessType").isLength({ min: 3, max: 255 }).trim().isString(),
            ],
            this.changeAccessType,
        );
        this.router.get("/geofences", this.getGeofences);
        this.router.post("/geofences", this.createGeofence);
        this.router.post("/geofences/subscribe/:geofenceId", this.subscribeGeofence);
        this.router.post("/geofences/unsubscribe/:geofenceId", this.unsubscribeGeofence);
        this.router.delete("/geofences/:geofenceId", this.deleteGeofence);
        this.router.post(
            "/beta-signup",
            [
                check("email").isLength({ min: 3 }).trim().isEmail(),
                check("platform").isLength({ min: 3 }).trim(),
            ],
            this.betaSignup,
        );
    };

    stop = async () => {
        this.httpServer.close();
        await this.rabbit.close();
        await this.pgClient.end();
    };

    updateState = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }
                // @ts-ignore: ts(7053)
                const newState: UserState | undefined = UserState[req.params.newState];
                if (!newState) {
                    throw new LocalizableError(Trans.InternalServerError, 501, "invalid state");
                }
                const result = await withSerializableTransaction(
                    this.pgClient,
                    async (connection) => {
                        await updateUserState(
                            {
                                username,
                                newState,
                            },
                            connection,
                        );
                        return getUserDetails({ username }, this.pgClient);
                    },
                );
                res.status(200).send({
                    success: true,
                    result,
                });
                try {
                    await this.sendEmergencyModeNotifications({ username }, req, newState);
                } catch (e) {
                    logger.error(e);
                }
            }),
        );

    getImage = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const image = req.params.image;
                const data = await this.storage.readImage(image);
                res.status(200).send(data);
            }),
        );

    getDevices = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const result = {
                    mine: await getDevices({ username }, this.pgClient),
                };
                const response = { result, success: true };
                res.status(200).send(response);
            }),
        );

    getHistoricalTelemetry = async (req: Request, res: Response) =>
        authWithDeviceId(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }
                const startTime: string = req.query["startTime"] as string;
                const endTime: string = req.query["endTime"] as string;
                const following: string = req.params.username;
                const result = await getHistoricalTelemetry(
                    { startTime, endTime, following, username },
                    this.pgClient,
                );
                res.status(200).send({ success: true, result });
            }),
        );

    getInvitations = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const devices = await getInvitations({ username }, this.pgClient);
                const response = { result: devices, success: true };
                res.status(200).send(response);
            }),
        );

    createInvitation = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                logger.debug(`${JSON.stringify(req.body)}`);
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }

                let invitation:
                    | EmailInvitationRequest<FollowerInvitation>
                    | EmailInvitationRequest<FollowerInvitation>;

                if (req.body.targetEmail) {
                    invitation = {
                        ...req.body,
                        targetEmail: req.body.targetEmail.toLowerCase().trim(),
                    };
                } else if (req.body.targetPhoneNumber) {
                    invitation = {
                        ...req.body,
                        targetPhoneNumber: getPhoneE164(req.body.targetPhoneNumber, req),
                    };
                } else {
                    throw new Error(translate(Trans.InvitationErrorNoPhoneOrEmail, req));
                }

                await withSerializableTransaction(this.pgClient, async (connection) => {
                    await createInvitation({ username, invitation }, connection);
                });
                const response = {
                    result: { message: translate(Trans.InvitationCreatedSuccessfully, req) },
                    success: true,
                };
                res.status(200).send(response);
                try {
                    switch (req.body.type) {
                        case InvitationType.Follower:
                            this.sendFollowerInvitationCreationNotifications({
                                username,
                                invitation,
                                req,
                            });
                            break;
                        default:
                            throw new Error("unable to find invitation type");
                    }
                } catch (e) {
                    logger.error(e);
                }
            }),
        );

    acceptInvitation = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }
                const invitations = await getInvitations({ username }, this.pgClient);
                await withSerializableTransaction(this.pgClient, async (connection) => {
                    await acceptInvitation(
                        {
                            username,
                            id: req.params.id,
                        },
                        connection,
                    );
                });
                res.status(200).send({
                    success: true,
                    result: { message: translate(Trans.Success, req) },
                });
                const invitation:
                    | EmailPendingInvitation<FollowerInvitation>
                    | PhonePendingInvitation<FollowerInvitation>
                    | undefined = invitations.received.find(
                    (invitation) => invitation.id === req.params.id,
                );
                if (invitation !== undefined) {
                    try {
                        switch (invitation.type) {
                            case InvitationType.Follower:
                                this.sendFollowerInvitationAcceptedNotifications({
                                    invitation,
                                });
                                break;
                            default:
                                throw new Error("unable to find invitation type");
                        }
                    } catch (e) {
                        logger.error(e.message);
                    }
                }
            }),
        );

    rejectInvitation = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }
                await withSerializableTransaction(this.pgClient, async (connection) => {
                    await rejectInvitation(
                        {
                            username,
                            id: req.params.id,
                        },
                        connection,
                    );
                });
                res.status(200).send({
                    success: true,
                    result: { message: translate(Trans.Success, req) },
                });
            }),
        );

    cancelInvitation = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }
                await withSerializableTransaction(this.pgClient, async (connection) => {
                    await cancelInvitation(
                        {
                            username,
                            id: req.params.id,
                        },
                        connection,
                    );
                });
                res.status(200).send({
                    success: true,
                    result: { message: translate(Trans.Success, req) },
                });
            }),
        );

    removeFollower = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }
                await withSerializableTransaction(this.pgClient, async (connection) => {
                    await removeFollower(
                        {
                            username: username,
                            usernameFollower: req.params.username,
                        },
                        connection,
                    );
                });
                res.status(200).send({
                    success: true,
                    result: { message: translate(Trans.Success, req) },
                });
            }),
        );

    changeAccessType = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }
                await withSerializableTransaction(this.pgClient, async (connection) => {
                    await changeAccessType(
                        {
                            follower: req.params.username,
                            accessType: req.params["accessType"],
                            username,
                        },
                        connection,
                    );
                });
                res.status(200).send({
                    success: true,
                    result: { message: translate(Trans.Success, req) },
                });
            }),
        );

    stopFollowing = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }
                await withSerializableTransaction(this.pgClient, async (connection) => {
                    await removeFollower(
                        {
                            username: req.params.username,
                            usernameFollower: username,
                        },
                        connection,
                    );
                });
                res.status(200).send({
                    success: true,
                    result: { message: translate(Trans.Success, req) },
                });
            }),
        );

    getGeofences = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }
                const result = await getGeofences({ username }, this.pgClient);
                const response = { result: result, success: true };
                res.status(200).send(response);
            }),
        );

    createGeofence = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async (username) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }

                const geofenceId = await createGeofence(
                    username.username,
                    { ...req.body },
                    this.pgClient,
                );
                const response = {
                    result: { message: "Created geofence", geofenceId: geofenceId },
                    success: true,
                };
                res.status(200).send(response);
            }),
        );

    subscribeGeofence = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async (username) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }
                const geofenceId = req.params.geofenceId;
                await subscribeToGeofence(
                    { geofenceId, subscriber: username.username },
                    this.pgClient,
                );
                res.status(200).send({
                    success: true,
                    result: {
                        message: translate(Trans.SubscribedToGeofence, req),
                    },
                });
            }),
        );

    unsubscribeGeofence = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async (username) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }
                const geofenceId = req.params.geofenceId;
                const success = await unsubscribeFromGeofence(
                    { geofenceId, subscriber: username.username },
                    this.pgClient,
                );
                if (success) {
                    const response = {
                        success: true,
                        result: { message: "Unsubscribed from geofence" },
                    };
                    res.status(200).send(response);
                } else {
                    const response = {
                        success: false,
                        result: { message: "No geofence subsciption found" },
                    };
                    res.status(403).send(response);
                }
            }),
        );

    deleteGeofence = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async (username) =>
            withErrorBoundary(req, res, async () => {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    throw createError(errors, req);
                }
                const geofenceId = req.params.geofenceId;
                const success = await deleteGeofence(
                    { geofenceId, owner: username.username },
                    this.pgClient,
                );
                if (success) {
                    const response = { success: true, result: { message: "Deleted geofence" } };
                    res.status(200).send(response);
                } else {
                    const response = {
                        success: false,
                        result: { message: "Unable to delete geofence" },
                    };
                    res.status(403).send(response);
                }
            }),
        );

    // TODO: Translate this.
    betaSignup = async (req: Request, res: Response) =>
        withErrorBoundary(req, res, async () => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw createError(errors, req);
            }
            const url = process.env.BETA_SIGNUP_SLACK_WEBHOOK_URL;
            if (!url) {
                logger.error(`Webhook url is missing from env. Body: ${req.body}`);
                throw TypeError;
            }
            const webhook = new IncomingWebhook(url);
            const { email, platform } = req.body;
            await webhook.send({
                text: `Received email ${email} on beta sign-up page for platform ${platform}.`,
            });
            res.status(200).send({
                success: true,
                result: {
                    message:
                        "Success! You will receive an email in the following 48 hours with instructions",
                },
            });
        });

    sendFollowerInvitationCreationNotifications = async ({
        username,
        invitation,
        req,
    }: {
        username: string;
        invitation:
            | EmailInvitationRequest<FollowerInvitation>
            | PhoneInvitationRequest<FollowerInvitation>;
        req: Request;
    }) => {
        const recipientPhoneOrEmail = invitation.targetEmail
            ? invitation.targetEmail
            : invitation.targetPhoneNumber;
        const recipientDeviceIds: string[] = await getAllDevicesForUserWithEmailOrPhone(
            recipientPhoneOrEmail,
            this.pgClient,
        );
        const recipientUserInfo = await getUserInfoWithEmailOrPhone(
            recipientPhoneOrEmail,
            this.pgClient,
        );
        const senderUserInfo = await getUserInfo(username, this.pgClient);

        if (recipientUserInfo !== undefined) {
            const {
                emails,
                sms,
                pushNotifications,
            } = this.buildExistingUserInvitationNotifications(
                recipientDeviceIds,
                recipientUserInfo,
                senderUserInfo,
            );
            this.rabbit.sendMessage({
                message: JSON.stringify([emails, pushNotifications, sms].flat()),
                routingKey: NOTIFICATIONS_ROUTING_KEY,
                exchange: notificationsExchange.name,
                options: NOTIFICATIONS_SERVER_DELIVERY_OPTIONS_EXPIRE_1_HOUR,
            });
        } else {
            if (invitation.targetPhoneNumber) {
                const sms: Sms[] = this.buildNonExistentUserInvitationSms(
                    invitation as PhoneInvitationRequest<FollowerInvitation>,
                    senderUserInfo,
                );
                this.rabbit.sendMessage({
                    message: JSON.stringify(sms),
                    routingKey: NOTIFICATIONS_ROUTING_KEY,
                    exchange: notificationsExchange.name,
                    options: NOTIFICATIONS_SERVER_DELIVERY_OPTIONS_EXPIRE_1_HOUR,
                });
            } else {
                const email: Email[] = this.buildNonExistentUserInvitationEmail(
                    invitation as EmailInvitationRequest<FollowerInvitation>,
                    senderUserInfo,
                );
                this.rabbit.sendMessage({
                    message: JSON.stringify(email),
                    routingKey: NOTIFICATIONS_ROUTING_KEY,
                    exchange: notificationsExchange.name,
                    options: NOTIFICATIONS_SERVER_DELIVERY_OPTIONS_EXPIRE_1_HOUR,
                });
            }
        }
    };

    buildExistingUserInvitationNotifications = (
        recipientDeviceIds: string[],
        recipientUserInfo: UserInfo,
        senderUserInfo: UserInfo,
    ): { emails: Email[]; sms: Sms[]; pushNotifications: PushNotification[] } => {
        const data = {
            title: translateWithFormat(
                Trans.PushNotificationInvitationCreatedTitle,
                recipientUserInfo.language,
                senderUserInfo.firstName,
            ),
            body: translateWithFormat(
                Trans.PushNotificationInvitationCreatedBody,
                recipientUserInfo.language,
                senderUserInfo.firstName,
            ),
        };

        const emails: Email[] = [];
        if (recipientUserInfo.email) {
            emails.push({
                username: recipientUserInfo.username,
                email: recipientUserInfo.email,
                templateId: GENERIC_EMAIL_TEMPLATE,
                dynamicTemplateData: {
                    ...data,
                    picture: encodeURI(`${CS_PROFILE_IMAGE_PATH}/${senderUserInfo.picture}`),
                    link: INVITATIONS_URL,
                    linkTitle: translateWithFormat(
                        Trans.PushNotificationActionView,
                        recipientUserInfo.language,
                    ),
                },
            });
        }

        const sms: Sms[] = [];
        if (recipientUserInfo.phoneNumber) {
            // TODO: Fix this notification body
            sms.push({
                to: recipientUserInfo.phoneNumber,
                body: translateWithFormat(
                    Trans.SmsInvitationCreatedBody,
                    recipientUserInfo.language,
                    senderUserInfo.firstName,
                    INVITATIONS_URL,
                ),
            });
        }

        const pushNotifications: PushNotification[] = recipientDeviceIds.map(
            (deviceId: string) => ({
                deviceId,
                data: {
                    ...data,
                    custom: {
                        url: INVITATIONS_URL,
                    },
                },
            }),
        );

        return { emails, sms, pushNotifications };
    };

    buildNonExistentUserInvitationEmail = (
        invitation: EmailInvitationRequest<FollowerInvitation>,
        senderUserInfo: UserInfo,
    ): Email[] => {
        const data = {
            title: translateWithFormat(
                Trans.PushNotificationInvitationCreatedTitle,
                senderUserInfo.language,
                senderUserInfo.firstName,
            ),
            body: translateWithFormat(
                Trans.PushNotificationInvitationCreatedBody,
                senderUserInfo.language,
                senderUserInfo.firstName,
            ),
        };

        return [
            {
                username: undefined,
                email: invitation.targetEmail,
                templateId: GENERIC_EMAIL_TEMPLATE,
                dynamicTemplateData: {
                    ...data,
                    picture: encodeURI(`${CS_PROFILE_IMAGE_PATH}/${senderUserInfo.picture}`),
                    link: INVITATIONS_URL,
                    linkTitle: translateWithFormat(
                        Trans.PushNotificationActionView,
                        senderUserInfo.language,
                    ),
                },
            },
        ];
    };

    buildNonExistentUserInvitationSms = (
        invitation: PhoneInvitationRequest<FollowerInvitation>,
        senderUserInfo: UserInfo,
    ): Sms[] => {
        return [
            {
                to: invitation.targetPhoneNumber,
                body: translateWithFormat(
                    Trans.SmsInvitationCreatedBody,
                    senderUserInfo.language,
                    senderUserInfo.firstName,
                    INVITATIONS_URL,
                ),
            },
            {
                to: invitation.targetPhoneNumber,
                body: translateWithFormat(
                    Trans.SmsInvitationCreatedBodyNewUser,
                    senderUserInfo.language,
                    PLAY_STORE_URL,
                    APP_STORE_URL,
                ),
            },
        ];
    };

    sendFollowerInvitationAcceptedNotifications = async ({
        invitation,
    }: {
        invitation:
            | PhonePendingInvitation<FollowerInvitation>
            | EmailPendingInvitation<FollowerInvitation>;
    }) => {
        let recipientPhoneOrEmail: string;
        if ((invitation as EmailPendingInvitation<FollowerInvitation>).targetEmail) {
            recipientPhoneOrEmail = (invitation as EmailPendingInvitation<FollowerInvitation>)
                .targetEmail;
        } else if ((invitation as PhonePendingInvitation<FollowerInvitation>).targetPhoneNumber) {
            recipientPhoneOrEmail = (invitation as PhonePendingInvitation<FollowerInvitation>)
                .targetPhoneNumber;
        } else {
            throw new Error("No phone or email provided");
        }
        const deviceIds: string[] = await getAllDevicesForUserWithEmailOrPhone(
            invitation.creator.email ? invitation.creator.email : invitation.creator.phoneNumber!,
            this.pgClient,
        );
        const { picture: senderPicture, language: senderLanguage } = await getUserInfo(
            invitation.creatorUsername,
            this.pgClient,
        );
        const recipientUserInfo = await getUserInfoWithEmailOrPhone(
            recipientPhoneOrEmail,
            this.pgClient,
        );

        if (!recipientUserInfo) {
            throw new Error("Unable to find recipient info");
        }

        const data = {
            title: translateWithFormat(
                Trans.PushNotificationInvitationAcceptedTitle,
                senderLanguage,
                recipientUserInfo.firstName,
            ),
            body: translateWithFormat(
                Trans.PushNotificationInvitationAcceptedBody,
                senderLanguage,
                recipientUserInfo.firstName,
            ),
        };

        // Prepare email
        const emails: Email[] = [];
        if (invitation.creator.email) {
            emails.push({
                username: invitation.creator.username,
                email: invitation.creator.email,
                templateId: GENERIC_EMAIL_TEMPLATE,
                dynamicTemplateData: {
                    ...data,
                    picture: encodeURI(`${CS_PROFILE_IMAGE_PATH}/${senderPicture}`),
                    link: INVITATIONS_URL,
                    linkTitle: translateWithFormat(
                        Trans.PushNotificationActionView,
                        senderLanguage,
                    ),
                },
            });
        }

        const sms: Sms[] = [];
        if (invitation.creator.phoneNumber) {
            sms.push({
                to: invitation.creator.phoneNumber,
                body: translateWithFormat(
                    Trans.PushNotificationInvitationAcceptedBody,
                    senderLanguage,
                    recipientUserInfo.firstName,
                ),
            });
        }

        const pushNotifications: PushNotification[] = deviceIds.map((deviceId: string) => ({
            deviceId,
            data,
        }));

        this.rabbit.sendMessage({
            message: JSON.stringify([emails, pushNotifications, sms].flat()),
            routingKey: NOTIFICATIONS_ROUTING_KEY,
            exchange: notificationsExchange.name,
            options: NOTIFICATIONS_SERVER_DELIVERY_OPTIONS_EXPIRE_1_HOUR,
        });
    };

    sendEmergencyModeNotifications = async (
        {
            username,
        }: {
            username: string;
        },
        req: Request,
        state: UserState,
    ) => {
        const recipients = await getEmergencyConnections(username, this.pgClient);
        recipients.map(async (recipient: NotificationRecipient) => {
            const { emails, pushNotifications } = await this.buildEmergencyNotifications(
                username,
                recipient,
                req,
                state,
            );
            this.rabbit.sendMessage({
                message: JSON.stringify([emails, pushNotifications].flat()),
                routingKey: NOTIFICATIONS_ROUTING_KEY,
                exchange: notificationsExchange.name,
                options: NOTIFICATIONS_SERVER_DELIVERY_OPTIONS_EXPIRE_1_HOUR,
            });
        });
    };

    buildEmergencyNotifications = async (
        senderUsername: string,
        recipient: NotificationRecipient,
        req: Request,
        state: UserState,
    ): Promise<Notifications> => {
        const senderUserInfo = await getUserInfo(senderUsername, this.pgClient);
        const recipientUserInfo = await getUserInfo(recipient.username, this.pgClient);
        const deviceIds: string[] = await getAllDevicesForUserWithEmailOrPhone(
            recipient.email,
            this.pgClient,
        );

        if (!recipientUserInfo) {
            throw new Error("Unable to find recipient info");
        }

        function getNotification(s: UserState) {
            if (s === UserState.Emergency) {
                // @ts-ignore
                return {
                    title: `RescueLink SOS`,
                    body: translateWithFormat(
                        Trans.EmergencyModePushNotificationBody,
                        recipientUserInfo.language,
                        senderUserInfo.firstName,
                    ),
                };
            } else {
                return {
                    title: `RescueLink SOS`,
                    body: translateWithFormat(
                        Trans.NormalModePushNotificationBody,
                        recipientUserInfo.language,
                        senderUserInfo.firstName,
                    ),
                };
            }
        }

        const emails: Email[] = [];
        if (recipientUserInfo.email) {
            emails.push({
                username: recipientUserInfo.username,
                email: recipientUserInfo.email,
                templateId: GENERIC_EMAIL_TEMPLATE,
                dynamicTemplateData: {
                    ...getNotification(state),
                    picture: encodeURI(`${CS_PROFILE_IMAGE_PATH}/${senderUserInfo.picture}`),
                    link: WEB_URL,
                    linkTitle: translateWithFormat(
                        Trans.PushNotificationActionView,
                        recipientUserInfo.language,
                    ),
                },
            });
        } else {
            new Error("No email found for user");
        }

        const pushNotifications: PushNotification[] = deviceIds.map((deviceId: string) => ({
            deviceId,
            data: getNotification(state),
        }));

        return { emails, pushNotifications };
    };
}
