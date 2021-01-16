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

import request from "supertest";
import getPort from "get-port";
import omit from "lodash/omit";
import amqp from "amqplib";
import isEqual from "lodash/isEqual";

import { ClientConfig } from "pg";
import {
    APP_STORE_URL,
    JWT_HEADER_TOKEN,
    PG_URL,
    PLAY_STORE_URL,
    RABBIT_MQ_URL_WITH_CREDS,
} from "../common/constants";
import { HTTPGateway } from "./index";
import { dbmate_rebuild } from "../common/dbmate";
import {
    acceptFollowerInvitation,
    createInvitation,
    getInvitations,
} from "../common/db/invitations";
import { withDB } from "../common/db/db";
import { AccessType, DBClientWithConnection, InvitationType, UserState } from "../common/types";
import { createGeofence } from "../common/db/geofences";
import { RabbitClient } from "../common/rabbit-helpers";
import { notificationsExchange } from "../common/rabbit-constants";
import { waitForCondition } from "../common/test_utils";
import {
    generateJwtTokenHelper,
    MOCK_PRIVATE_KEY,
    MOCK_PUBLIC_KEY,
} from "../common/authentication";
import {
    registerWithEmail,
    registerDevice,
    registerPublicKey2,
    updateUserLanguage,
    updateUserDetails,
} from "../common/db/authentication";
import { updateUserState } from "../common/db/device-management";
import uuid from "uuid";

const invitationForUser = (sender: string, target: string) => ({
    username: sender,
    invitation: {
        targetEmail: target,
        invitation: {
            isEmergencyContact: false,
            accessType: AccessType.Permanent,
        },
        type: InvitationType.Follower,
    },
});

export const removeFields = (object: any, paths: string[]): any => {
    if (Array.isArray(object)) {
        return object.map((element) => removeFields(element, paths));
    } else {
        const returnObject = omit(object, paths);
        Object.keys(returnObject).map((key: any) => {
            if (typeof object[key] === "object") {
                returnObject[key] = removeFields(object[key], paths);
            }
        });
        return returnObject;
    }
};

const removeIdsAndStamps = (object: any) =>
    removeFields(object, [
        "creationTimestamp",
        "creation_timestamp",
        "updateTimestamp",
        "update_timestamp",
        "timestamp",
        "id",
    ]);

const storageOptions = {
    bucketName: "",
    localStoragePath: "",
    cloudStorageCredentials: "",
    cloudStorageProject: "",
    storageType: " ",
};

const pgConfig: ClientConfig = {
    keepAlive: true,
    connectionString: PG_URL,
};

describe("HTTPGateway", () => {
    const darioToken = generateJwtTokenHelper(MOCK_PRIVATE_KEY, {
        username: "dario",
        deviceId: "dario_iphone",
    });
    const cocheToken = generateJwtTokenHelper(MOCK_PRIVATE_KEY, {
        username: "coche",
        deviceId: "coche_iphone",
    });
    describe("/invitations", () => {
        let service: HTTPGateway;
        let rabbit: RabbitClient;

        beforeEach(async () => {
            await dbmate_rebuild();
            service = new HTTPGateway(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                pgConfig,
                {},
                storageOptions,
            );
            await service.start();

            rabbit = new RabbitClient(RABBIT_MQ_URL_WITH_CREDS(), [notificationsExchange], {
                name: uuid.v4(),
            });
            await rabbit.start();
        });

        afterEach(async () => {
            service.stop();
            await rabbit.close();
        });

        test("no token returns 403", async (done) => {
            request(service.router).get("/invitations").send({}).expect(403, done);
        }, 1000);

        test("valid token returns 200", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .get("/invitations")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send()
                .end((req, res) => {
                    expect(res.body).toEqual({
                        success: true,
                        result: {
                            sent: [],
                            received: [],
                        },
                    });
                    done();
                });
        }, 1000);

        test("create follower invitation and accept it then remove it", async (done) => {
            let currentMessage: any = undefined;
            // 1. Setup rabbitmq sub to intercept invitation created and accepted messages.
            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                // @ts-ignore
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });

            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            await registerPublicKey2(
                { username: "coche", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );

            await request(service.router)
                .post("/invitations")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send({
                    targetEmail: "luiscoche9@gmail.com",
                    invitation: {
                        isEmergencyContact: false,
                        accessType: AccessType.Permanent,
                    },
                    type: InvitationType.Follower,
                })
                .expect(200);

            await waitForCondition({
                timeoutMs: 3000,
                pollPeriodMs: 100,
                errorToThrow: () =>
                    new Error(
                        `did not receive the correct invitation create, got ${JSON.stringify(
                            currentMessage,
                        )} `,
                    ),
                callback: () => {
                    return isEqual(currentMessage, [
                        {
                            username: "coche",
                            email: "luiscoche9@gmail.com",
                            templateId: "d-f4c36d6358cd445e9a873e103c3efe05",
                            dynamicTemplateData: {
                                title: "Dario sent you an invitation",
                                body: "Dario wants you to follow them",
                                picture:
                                    "https://storage.cloud.google.com/rescuelink_user_pictures/predator.png",
                                link: "https://armore.dev/invitations",
                                linkTitle: "Go to App",
                            },
                        },
                        {
                            deviceId: "coche_iphone",
                            data: {
                                title: "Dario sent you an invitation",
                                body: "Dario wants you to follow them",
                                custom: {
                                    url: "https://armore.dev/invitations",
                                },
                            },
                        },
                    ]);
                },
            });

            const { body: darioInvitations } = await request(service.router)
                .get("/invitations")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send()
                .expect(200);
            expect(removeIdsAndStamps(darioInvitations)).toEqual({
                result: {
                    received: [],
                    sent: [
                        {
                            creator: {
                                email: "darioalessandrolencina@gmail.com",
                                phoneNumber: undefined,
                                firstName: "Dario",
                                lastName: "Lencina-Talarico",
                                picture: "predator.png",
                                username: "dario",
                            },
                            creatorUsername: "dario",
                            invitation: {
                                accessType: "Permanent",
                                isEmergencyContact: false,
                            },
                            status: "created",
                            targetEmail: "luiscoche9@gmail.com",
                            targetPhoneNumber: undefined,
                            type: "follower",
                        },
                    ],
                },
                success: true,
            });

            const { body: cocheInvitations } = await request(service.router)
                .get("/invitations")
                .set(JWT_HEADER_TOKEN, cocheToken)
                .send()
                .expect(200);
            expect(removeIdsAndStamps(cocheInvitations)).toEqual({
                result: {
                    sent: [],
                    received: [
                        {
                            creator: {
                                email: "darioalessandrolencina@gmail.com",
                                firstName: "Dario",
                                lastName: "Lencina-Talarico",
                                picture: "predator.png",
                                username: "dario",
                            },
                            creatorUsername: "dario",
                            invitation: {
                                accessType: "Permanent",
                                isEmergencyContact: false,
                            },
                            status: "created",
                            targetEmail: "luiscoche9@gmail.com",
                            targetPhoneNumber: undefined,
                            type: "follower",
                        },
                    ],
                },
                success: true,
            });

            // Accept invitation.
            const { body: acceptResponse } = await request(service.router)
                .post(`/invitations/${cocheInvitations.result.received[0].id}/accept`)
                .set(JWT_HEADER_TOKEN, cocheToken)
                .send()
                .expect(200);

            expect(acceptResponse).toEqual({ success: true, result: { message: "Success" } });

            await waitForCondition({
                timeoutMs: 3000,
                pollPeriodMs: 100,
                errorToThrow: () =>
                    new Error(
                        `did not receive the correct invitation accepted, ${JSON.stringify(
                            currentMessage,
                        )}`,
                    ),
                callback: () => {
                    return isEqual(currentMessage, [
                        {
                            username: "dario",
                            email: "darioalessandrolencina@gmail.com",
                            templateId: "d-f4c36d6358cd445e9a873e103c3efe05",
                            dynamicTemplateData: {
                                title: "Coche accepted your invitation",
                                body: "Coche is now following you",
                                picture:
                                    "https://storage.cloud.google.com/rescuelink_user_pictures/predator.png",
                                link: "https://armore.dev/invitations",
                                linkTitle: "Go to App",
                            },
                        },
                        {
                            deviceId: "dario_iphone",
                            data: {
                                title: "Coche accepted your invitation",
                                body: "Coche is now following you",
                            },
                        },
                    ]);
                },
            });

            // Check that tables are created.
            expect(
                removeIdsAndStamps(
                    (
                        await service.pgClient.connection!.query(
                            "SELECT * FROM users_followers WHERE username = 'dario'",
                        )
                    ).rows,
                ),
            ).toEqual([
                {
                    username: "dario",
                    username_follower: "billburr",
                    is_emergency_contact: true,
                    access_type: AccessType.Permanent,
                },
                {
                    username: "dario",
                    username_follower: "coche",
                    is_emergency_contact: true,
                    access_type: AccessType.Permanent,
                },
                {
                    username: "dario",
                    username_follower: "louisck",
                    is_emergency_contact: true,
                    access_type: AccessType.Permanent,
                },
            ]);
            expect(
                removeIdsAndStamps(
                    (
                        await service.pgClient.connection!.query(
                            "SELECT * FROM users_followers_state WHERE username = 'dario'",
                        )
                    ).rows,
                ),
            ).toEqual([
                {
                    username: "dario",
                    username_follower: "billburr",
                    follower_perception: UserState.Normal,
                },
                {
                    username: "dario",
                    username_follower: "coche",
                    follower_perception: UserState.Normal,
                },
                {
                    username: "dario",
                    username_follower: "louisck",
                    follower_perception: UserState.Normal,
                },
            ]);
            expect(
                removeIdsAndStamps(
                    (
                        await service.pgClient.connection!.query(
                            "SELECT * FROM users_followers WHERE username = 'coche'",
                        )
                    ).rows,
                ),
            ).toEqual([
                {
                    username: "coche",
                    username_follower: "dario",
                    is_emergency_contact: true,
                    access_type: AccessType.Permanent,
                },
            ]);
            expect(
                removeIdsAndStamps(
                    (
                        await service.pgClient.connection!.query(
                            "SELECT * FROM users_followers_state WHERE username = 'coche'",
                        )
                    ).rows,
                ),
            ).toEqual([
                {
                    username: "coche",
                    username_follower: "dario",
                    follower_perception: UserState.Normal,
                },
            ]);

            // Remove follower
            const { body: removeFollowerResponse } = await request(service.router)
                .delete(`/me/connections/followers/coche`)
                .set(JWT_HEADER_TOKEN, darioToken)
                .send();

            expect(removeIdsAndStamps(removeFollowerResponse)).toEqual({
                success: true,
                result: { message: "Success" },
            });

            expect(removeFollowerResponse).toEqual({
                success: true,
                result: { message: "Success" },
            });
            expect(
                removeIdsAndStamps(
                    (
                        await service.pgClient.connection!.query(
                            "SELECT * FROM users_followers WHERE username = 'dario'",
                        )
                    ).rows,
                ),
            ).toEqual([
                {
                    username: "dario",
                    username_follower: "billburr",
                    is_emergency_contact: true,
                    access_type: AccessType.Permanent,
                },
                {
                    username: "dario",
                    username_follower: "louisck",
                    is_emergency_contact: true,
                    access_type: AccessType.Permanent,
                },
            ]);
            expect(
                removeIdsAndStamps(
                    (
                        await service.pgClient.connection!.query(
                            "SELECT * FROM users_followers_state WHERE username = 'dario'",
                        )
                    ).rows,
                ),
            ).toEqual([
                {
                    username: "dario",
                    username_follower: "billburr",
                    follower_perception: UserState.Normal,
                },
                {
                    username: "dario",
                    username_follower: "louisck",
                    follower_perception: UserState.Normal,
                },
            ]);
            done();
        }, 5000);

        test("create follower invitation using a phone number and accept it then remove it", async (done) => {
            let currentMessage: any = undefined;
            const cochePhone = "+18888888889";
            const darioPhone = "+18888888888";
            // 1. Setup rabbitmq sub to intercept invitation created and accepted messages.
            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                // @ts-ignore
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });

            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            await registerPublicKey2(
                { username: "coche", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );

            // Add a phone number to the accounts
            await updateUserDetails(
                { username: "coche" },
                undefined,
                undefined,
                undefined,
                cochePhone,
                service.pgClient,
            );
            await updateUserDetails(
                { username: "dario" },
                undefined,
                undefined,
                undefined,
                darioPhone,
                service.pgClient,
            );

            await request(service.router)
                .post("/invitations")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send({
                    targetPhoneNumber: cochePhone,
                    invitation: {
                        isEmergencyContact: false,
                        accessType: AccessType.Permanent,
                    },
                    type: InvitationType.Follower,
                })
                .expect(200);

            await waitForCondition({
                timeoutMs: 3000,
                pollPeriodMs: 100,
                errorToThrow: () =>
                    new Error(
                        `did not receive the correct invitation create, got ${JSON.stringify(
                            currentMessage,
                        )} `,
                    ),
                callback: () => {
                    return isEqual(currentMessage, [
                        {
                            username: "coche",
                            email: "luiscoche9@gmail.com",
                            templateId: "d-f4c36d6358cd445e9a873e103c3efe05",
                            dynamicTemplateData: {
                                title: "Dario sent you an invitation",
                                body: "Dario wants you to follow them",
                                picture:
                                    "https://storage.cloud.google.com/rescuelink_user_pictures/predator.png",
                                link: "https://armore.dev/invitations",
                                linkTitle: "Go to App",
                            },
                        },
                        {
                            deviceId: "coche_iphone",
                            data: {
                                title: "Dario sent you an invitation",
                                body: "Dario wants you to follow them",
                                custom: {
                                    url: "https://armore.dev/invitations",
                                },
                            },
                        },
                        {
                            to: cochePhone,
                            body:
                                "Dario wants you to follow them in the Armore app. Armore is the best app to track your loved ones using end to end encryption. https://armore.dev/invitations",
                        },
                    ]);
                },
            });

            const { body: darioInvitations } = await request(service.router)
                .get("/invitations")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send()
                .expect(200);
            expect(removeIdsAndStamps(darioInvitations)).toEqual({
                result: {
                    received: [],
                    sent: [
                        {
                            creator: {
                                email: "darioalessandrolencina@gmail.com",
                                phoneNumber: darioPhone,
                                firstName: "Dario",
                                lastName: "Lencina-Talarico",
                                picture: "predator.png",
                                username: "dario",
                            },
                            creatorUsername: "dario",
                            invitation: {
                                accessType: "Permanent",
                                isEmergencyContact: false,
                            },
                            status: "created",
                            targetEmail: undefined,
                            targetPhoneNumber: cochePhone,
                            type: "follower",
                        },
                    ],
                },
                success: true,
            });

            const { body: cocheInvitations } = await request(service.router)
                .get("/invitations")
                .set(JWT_HEADER_TOKEN, cocheToken)
                .send()
                .expect(200);
            expect(removeIdsAndStamps(cocheInvitations)).toEqual({
                result: {
                    sent: [],
                    received: [
                        {
                            creator: {
                                email: "darioalessandrolencina@gmail.com",
                                phoneNumber: darioPhone,
                                firstName: "Dario",
                                lastName: "Lencina-Talarico",
                                picture: "predator.png",
                                username: "dario",
                            },
                            creatorUsername: "dario",
                            invitation: {
                                accessType: "Permanent",
                                isEmergencyContact: false,
                            },
                            status: "created",
                            targetEmail: undefined,
                            targetPhoneNumber: cochePhone,
                            type: "follower",
                        },
                    ],
                },
                success: true,
            });

            // Accept invitation.
            const { body: acceptResponse } = await request(service.router)
                .post(`/invitations/${cocheInvitations.result.received[0].id}/accept`)
                .set(JWT_HEADER_TOKEN, cocheToken)
                .send()
                .expect(200);

            expect(acceptResponse).toEqual({ success: true, result: { message: "Success" } });

            await waitForCondition({
                timeoutMs: 3000,
                pollPeriodMs: 100,
                errorToThrow: () =>
                    new Error(
                        `did not receive the correct invitation accepted, ${JSON.stringify(
                            currentMessage,
                        )}`,
                    ),
                callback: () => {
                    return isEqual(currentMessage, [
                        {
                            username: "dario",
                            email: "darioalessandrolencina@gmail.com",
                            templateId: "d-f4c36d6358cd445e9a873e103c3efe05",
                            dynamicTemplateData: {
                                title: "Coche accepted your invitation",
                                body: "Coche is now following you",
                                picture:
                                    "https://storage.cloud.google.com/rescuelink_user_pictures/predator.png",
                                link: "https://armore.dev/invitations",
                                linkTitle: "Go to App",
                            },
                        },
                        {
                            deviceId: "dario_iphone",
                            data: {
                                title: "Coche accepted your invitation",
                                body: "Coche is now following you",
                            },
                        },
                        {
                            to: darioPhone,
                            body: "Coche is now following you",
                        },
                    ]);
                },
            });

            // Check that tables are created.
            expect(
                removeIdsAndStamps(
                    (
                        await service.pgClient.connection!.query(
                            "SELECT * FROM users_followers WHERE username = 'dario'",
                        )
                    ).rows,
                ),
            ).toEqual([
                {
                    username: "dario",
                    username_follower: "billburr",
                    is_emergency_contact: true,
                    access_type: AccessType.Permanent,
                },
                {
                    username: "dario",
                    username_follower: "coche",
                    is_emergency_contact: true,
                    access_type: AccessType.Permanent,
                },
                {
                    username: "dario",
                    username_follower: "louisck",
                    is_emergency_contact: true,
                    access_type: AccessType.Permanent,
                },
            ]);
            expect(
                removeIdsAndStamps(
                    (
                        await service.pgClient.connection!.query(
                            "SELECT * FROM users_followers_state WHERE username = 'dario'",
                        )
                    ).rows,
                ),
            ).toEqual([
                {
                    username: "dario",
                    username_follower: "billburr",
                    follower_perception: UserState.Normal,
                },
                {
                    username: "dario",
                    username_follower: "coche",
                    follower_perception: UserState.Normal,
                },
                {
                    username: "dario",
                    username_follower: "louisck",
                    follower_perception: UserState.Normal,
                },
            ]);
            expect(
                removeIdsAndStamps(
                    (
                        await service.pgClient.connection!.query(
                            "SELECT * FROM users_followers WHERE username = 'coche'",
                        )
                    ).rows,
                ),
            ).toEqual([
                {
                    username: "coche",
                    username_follower: "dario",
                    is_emergency_contact: true,
                    access_type: AccessType.Permanent,
                },
            ]);
            expect(
                removeIdsAndStamps(
                    (
                        await service.pgClient.connection!.query(
                            "SELECT * FROM users_followers_state WHERE username = 'coche'",
                        )
                    ).rows,
                ),
            ).toEqual([
                {
                    username: "coche",
                    username_follower: "dario",
                    follower_perception: UserState.Normal,
                },
            ]);

            // Remove follower
            const { body: removeFollowerResponse } = await request(service.router)
                .delete(`/me/connections/followers/coche`)
                .set(JWT_HEADER_TOKEN, darioToken)
                .send();

            expect(removeIdsAndStamps(removeFollowerResponse)).toEqual({
                success: true,
                result: { message: "Success" },
            });

            expect(removeFollowerResponse).toEqual({
                success: true,
                result: { message: "Success" },
            });
            expect(
                removeIdsAndStamps(
                    (
                        await service.pgClient.connection!.query(
                            "SELECT * FROM users_followers WHERE username = 'dario'",
                        )
                    ).rows,
                ),
            ).toEqual([
                {
                    username: "dario",
                    username_follower: "billburr",
                    is_emergency_contact: true,
                    access_type: AccessType.Permanent,
                },
                {
                    username: "dario",
                    username_follower: "louisck",
                    is_emergency_contact: true,
                    access_type: AccessType.Permanent,
                },
            ]);
            expect(
                removeIdsAndStamps(
                    (
                        await service.pgClient.connection!.query(
                            "SELECT * FROM users_followers_state WHERE username = 'dario'",
                        )
                    ).rows,
                ),
            ).toEqual([
                {
                    username: "dario",
                    username_follower: "billburr",
                    follower_perception: UserState.Normal,
                },
                {
                    username: "dario",
                    username_follower: "louisck",
                    follower_perception: UserState.Normal,
                },
            ]);
            done();
        }, 5000);

        test("create follower invitation for new user", async (done) => {
            let currentMessage: any = undefined;
            const newPhone = "+18888888888";
            // 1. Setup rabbitmq sub to intercept invitation created and accepted messages.
            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                // @ts-ignore
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });

            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );

            await request(service.router)
                .post("/invitations")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send({
                    targetPhoneNumber: newPhone,
                    invitation: {
                        isEmergencyContact: false,
                        accessType: AccessType.Permanent,
                    },
                    type: InvitationType.Follower,
                })
                .expect(200);

            await waitForCondition({
                timeoutMs: 3000,
                pollPeriodMs: 100,
                errorToThrow: () =>
                    new Error(
                        `did not receive the correct invitation create, got ${JSON.stringify(
                            currentMessage,
                        )} `,
                    ),
                callback: () => {
                    return isEqual(currentMessage, [
                        {
                            to: newPhone,
                            body:
                                "Dario wants you to follow them in the Armore app. Armore is the best app to track your loved ones using end to end encryption. https://armore.dev/invitations",
                        },
                        {
                            to: newPhone,
                            body: `Android: ${PLAY_STORE_URL}\n\niOS: ${APP_STORE_URL}`,
                        },
                    ]);
                },
            });

            const { body: darioInvitations } = await request(service.router)
                .get("/invitations")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send()
                .expect(200);
            expect(removeIdsAndStamps(darioInvitations)).toEqual({
                result: {
                    received: [],
                    sent: [
                        {
                            creator: {
                                email: "darioalessandrolencina@gmail.com",
                                phoneNumber: undefined,
                                firstName: "Dario",
                                lastName: "Lencina-Talarico",
                                picture: "predator.png",
                                username: "dario",
                            },
                            creatorUsername: "dario",
                            invitation: {
                                accessType: "Permanent",
                                isEmergencyContact: false,
                            },
                            status: "created",
                            targetEmail: undefined,
                            targetPhoneNumber: newPhone,
                            type: "follower",
                        },
                    ],
                },
                success: true,
            });
            done();
        }, 5000);

        test("create and accepted follower invitation notification should appear in the recipient language", async () => {
            let currentMessage: any = undefined;
            // 1. Setup rabbitmq sub to intercept invitation created and accepted messages.
            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                // @ts-ignore
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });

            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            await registerPublicKey2(
                { username: "coche", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );

            await updateUserLanguage({ username: "coche", language: "es" }, service.pgClient);

            await request(service.router)
                .post("/invitations")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send({
                    targetEmail: "luiscoche9@gmail.com",
                    invitation: {
                        isEmergencyContact: false,
                        accessType: AccessType.Permanent,
                    },
                    type: InvitationType.Follower,
                })
                .expect(200);

            await waitForCondition({
                timeoutMs: 3000,
                pollPeriodMs: 100,
                errorToThrow: () =>
                    new Error(
                        `did not receive the correct invitation create, got ${JSON.stringify(
                            currentMessage,
                        )} `,
                    ),
                callback: () => {
                    return isEqual(currentMessage, [
                        {
                            username: "coche",
                            email: "luiscoche9@gmail.com",
                            templateId: "d-f4c36d6358cd445e9a873e103c3efe05",
                            dynamicTemplateData: {
                                title: "Dario te mandó una invitación",
                                body: "Dario quiere que l@ sigas",
                                picture:
                                    "https://storage.cloud.google.com/rescuelink_user_pictures/predator.png",
                                link: "https://armore.dev/invitations",
                                linkTitle: "Ir a la App",
                            },
                        },
                        {
                            deviceId: "coche_iphone",
                            data: {
                                title: "Dario te mandó una invitación",
                                body: "Dario quiere que l@ sigas",
                                custom: {
                                    url: "https://armore.dev/invitations",
                                },
                            },
                        },
                    ]);
                },
            });

            const { body: cocheInvitations } = await request(service.router)
                .get("/invitations")
                .set(JWT_HEADER_TOKEN, cocheToken)
                .send()
                .expect(200);

            // Accept invitation.
            const { body: acceptResponse } = await request(service.router)
                .post(`/invitations/${cocheInvitations.result.received[0].id}/accept`)
                .set(JWT_HEADER_TOKEN, cocheToken)
                .send()
                .expect(200);

            await waitForCondition({
                timeoutMs: 3000,
                pollPeriodMs: 100,
                errorToThrow: () =>
                    new Error(
                        `did not receive the correct invitation accepted, ${JSON.stringify(
                            currentMessage,
                        )}`,
                    ),
                callback: () => {
                    return isEqual(currentMessage, [
                        {
                            username: "dario",
                            email: "darioalessandrolencina@gmail.com",
                            templateId: "d-f4c36d6358cd445e9a873e103c3efe05",
                            dynamicTemplateData: {
                                title: "Coche accepted your invitation",
                                body: "Coche is now following you",
                                picture:
                                    "https://storage.cloud.google.com/rescuelink_user_pictures/predator.png",
                                link: "https://armore.dev/invitations",
                                linkTitle: "Go to App",
                            },
                        },
                        {
                            deviceId: "dario_iphone",
                            data: {
                                title: "Coche accepted your invitation",
                                body: "Coche is now following you",
                            },
                        },
                    ]);
                },
            });
        });

        test("invitations should be normalized to lower caps", async () => {
            let currentMessage: any = undefined;
            // 1. Setup rabbitmq sub to intercept invitation created and accepted messages.
            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                // @ts-ignore
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });

            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            await registerPublicKey2(
                { username: "coche", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );

            await updateUserLanguage({ username: "coche", language: "es" }, service.pgClient);

            await request(service.router)
                .post("/invitations")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send({
                    targetEmail: "LuisCoche9@gmail.com",
                    invitation: {
                        isEmergencyContact: false,
                        accessType: AccessType.Permanent,
                    },
                    type: InvitationType.Follower,
                })
                .expect(200);

            await waitForCondition({
                timeoutMs: 3000,
                pollPeriodMs: 100,
                errorToThrow: () =>
                    new Error(
                        `did not receive the correct invitation create, got ${JSON.stringify(
                            currentMessage,
                        )} `,
                    ),
                callback: () => {
                    return isEqual(currentMessage, [
                        {
                            username: "coche",
                            email: "luiscoche9@gmail.com",
                            templateId: "d-f4c36d6358cd445e9a873e103c3efe05",
                            dynamicTemplateData: {
                                title: "Dario te mandó una invitación",
                                body: "Dario quiere que l@ sigas",
                                picture:
                                    "https://storage.cloud.google.com/rescuelink_user_pictures/predator.png",
                                link: "https://armore.dev/invitations",
                                linkTitle: "Ir a la App",
                            },
                        },
                        {
                            deviceId: "coche_iphone",
                            data: {
                                title: "Dario te mandó una invitación",
                                body: "Dario quiere que l@ sigas",
                                custom: {
                                    url: "https://armore.dev/invitations",
                                },
                            },
                        },
                    ]);
                },
            });

            const { body: cocheInvitations } = await request(service.router)
                .get("/invitations")
                .set(JWT_HEADER_TOKEN, cocheToken)
                .send()
                .expect(200);

            expect(removeIdsAndStamps(cocheInvitations)).toEqual({
                result: {
                    received: [
                        {
                            creator: {
                                email: "darioalessandrolencina@gmail.com",
                                phoneNumber: undefined,
                                firstName: "Dario",
                                lastName: "Lencina-Talarico",
                                picture: "predator.png",
                                username: "dario",
                            },
                            creatorUsername: "dario",
                            invitation: {
                                accessType: "Permanent",
                                isEmergencyContact: false,
                            },
                            status: "created",
                            targetEmail: "luiscoche9@gmail.com",
                            targetPhoneNumber: undefined,
                            type: "follower",
                        },
                    ],
                    sent: [],
                },
                success: true,
            });

            // Accept invitation.
            const { body: acceptResponse } = await request(service.router)
                .post(`/invitations/${cocheInvitations.result.received[0].id}/accept`)
                .set(JWT_HEADER_TOKEN, cocheToken)
                .send()
                .expect(200);

            await waitForCondition({
                timeoutMs: 3000,
                pollPeriodMs: 100,
                errorToThrow: () =>
                    new Error(
                        `did not receive the correct invitation accepted, ${JSON.stringify(
                            currentMessage,
                        )}`,
                    ),
                callback: () => {
                    return isEqual(currentMessage, [
                        {
                            username: "dario",
                            email: "darioalessandrolencina@gmail.com",
                            templateId: "d-f4c36d6358cd445e9a873e103c3efe05",
                            dynamicTemplateData: {
                                title: "Coche accepted your invitation",
                                body: "Coche is now following you",
                                picture:
                                    "https://storage.cloud.google.com/rescuelink_user_pictures/predator.png",
                                link: "https://armore.dev/invitations",
                                linkTitle: "Go to App",
                            },
                        },
                        {
                            deviceId: "dario_iphone",
                            data: {
                                title: "Coche accepted your invitation",
                                body: "Coche is now following you",
                            },
                        },
                    ]);
                },
            });
        });

        test("users can have up to 10 followers", async () => {
            // create 12 users
            const users = new Array(12).fill(0, 0, 12).map((value, index) => index);
            const username = "user0";
            const db = await withDB(service.pgClient);

            await Promise.all(
                users.map((i) =>
                    registerWithEmail(
                        {
                            username: `user${i}`,
                            publicKey: `pk`,
                            email: `user${i}@fakemail.com`,
                            firstName: "Lalo",
                            lastName: "Landa",
                            picture: undefined,
                            language: "en",
                        },
                        db,
                    ),
                ),
            );

            await Promise.all(
                users.slice(1, 11).map(async (i) => {
                    await createInvitation(
                        invitationForUser(username, `user${i}@fakemail.com`),
                        db,
                    );
                }),
            );
            const { sent } = await getInvitations({ username }, service.pgClient);
            expect(sent.length).toEqual(10);
            await Promise.all(
                users.slice(1, 11).map(async (i) => {
                    const targetUsername = `user${i}`;
                    const { received } = await getInvitations(
                        { username: targetUsername },
                        service.pgClient,
                    );
                    // Accept them all.
                    expect(received.length).toEqual(1);
                    const invitation = received[0];
                    await acceptFollowerInvitation(
                        { username: targetUsername, id: invitation.id },
                        db,
                    );
                }),
            );

            const { sent: sent2 } = await getInvitations({ username }, service.pgClient);
            expect(sent2.length).toEqual(0);

            const followers = (
                await db.connection.query(
                    "SELECT * FROM users_followers " + "WHERE users_followers.username = $1",
                    [`user0`],
                )
            ).rowCount;
            expect(followers).toEqual(10);

            async function throws() {
                await createInvitation(invitationForUser(username, `useryolo@fakemail.com`), db);
            }
            await expect(throws()).rejects.toThrow();
        });
    });

    describe("/devices", () => {
        let service: HTTPGateway;

        beforeEach(async () => {
            await dbmate_rebuild();
            service = new HTTPGateway(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                pgConfig,
                {},
                storageOptions,
            );
            await service.start();
        });

        afterEach((done) => {
            service.stop();
            done();
        });

        test("no token returns 403", async (done) => {
            request(service.router).get("/devices").send({}).expect(403, done);
        }, 1000);

        test("valid token returns 200", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .get("/devices")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send()
                .end((req, res) => {
                    expect(res.body).toEqual({
                        success: true,
                        result: {
                            mine: [
                                {
                                    deviceId: "dario_iphone",
                                    model: "UNKNOWN",
                                    name: "dario_iphone",
                                    os: "UNKNOWN",
                                    osVersion: "UNKNOWN",
                                    role: "phone",
                                },
                            ],
                        },
                    });
                    done();
                });
        }, 1000);
    });

    describe("/geofences", () => {
        let service: HTTPGateway;

        beforeEach(async () => {
            await dbmate_rebuild();
            service = new HTTPGateway(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                pgConfig,
                {},
                storageOptions,
            );
            await service.start();
        });

        afterEach((done) => {
            service.stop();
            done();
        });

        test("no token returns 403", async (done) => {
            request(service.router).get("/geofences").send({}).expect(403, done);
        }, 1000);

        test("valid token returns geofences", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            const geofenceId = await createGeofence(
                "dario",
                {
                    address: "123 main st.",
                    username: "dario",
                    lat: 12.3,
                    lon: -98.2,
                    name: "work",
                    radius: 50,
                },
                service.pgClient,
            );

            request(service.router)
                .get("/geofences")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send()
                .end((req, res) => {
                    expect(res.body).toEqual({
                        success: true,
                        result: {
                            mine: [
                                {
                                    active: false,
                                    address: "123 main st.",
                                    id: geofenceId,
                                    lat: 12.3,
                                    lon: -98.2,
                                    name: "work",
                                    radius: 50,
                                    username: "dario",
                                },
                            ],
                            subscribed: [
                                {
                                    active: false,
                                    address: "PRIVATE",
                                    id: 1,
                                    lat: 42.2933922,
                                    lon: -83.68552609999999,
                                    name: "PRIVATE",
                                    radius: 50,
                                    username: "PRIVATE",
                                },
                                {
                                    active: false,
                                    address: "PRIVATE",
                                    id: 2,
                                    lat: 42.281659,
                                    lon: -83.749949,
                                    name: "PRIVATE",
                                    radius: 25,
                                    username: "PRIVATE",
                                },
                                {
                                    active: false,
                                    address: "PRIVATE",
                                    id: 3,
                                    lat: 42.3314,
                                    lon: -83.0458,
                                    name: "PRIVATE",
                                    radius: 150,
                                    username: "PRIVATE",
                                },
                            ],
                            unsubscribed: [],
                        },
                    });
                    done();
                });
        }, 1000);

        test("create your own geofences", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            const geofence = {
                address: "123 main st.",
                username: "dario",
                lat: 12.3,
                lon: -98.2,
                name: "work",
                radius: 50,
            };

            request(service.router)
                .post("/geofences")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send(geofence)
                .end((req, res) => {
                    delete res.body.result.geofenceId;
                    expect(res.body).toEqual({
                        success: true,
                        result: {
                            message: "Created geofence",
                        },
                    });
                    done();
                });
        }, 1000);

        test("create geofences for people you follow", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            await registerPublicKey2(
                { username: "coche", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );

            await request(service.router)
                .post("/invitations")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send({
                    targetEmail: "luiscoche9@gmail.com",
                    invitation: {
                        isEmergencyContact: false,
                        accessType: AccessType.Permanent,
                    },
                    type: InvitationType.Follower,
                })
                .expect(200);

            const { body: darioInvitations } = await request(service.router)
                .get("/invitations")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send()
                .expect(200);

            const { body: cocheInvitations } = await request(service.router)
                .get("/invitations")
                .set(JWT_HEADER_TOKEN, cocheToken)
                .send()
                .expect(200);

            // Accept invitation.
            const { body: acceptResponse } = await request(service.router)
                .post(`/invitations/${cocheInvitations.result.received[0].id}/accept`)
                .set(JWT_HEADER_TOKEN, cocheToken)
                .send()
                .expect(200);

            expect(acceptResponse).toEqual({ success: true, result: { message: "Success" } });

            const geofence = {
                address: "123 main st.",
                username: "coche",
                lat: 12.3,
                lon: -98.2,
                name: "work",
                radius: 50,
            };

            request(service.router)
                .post("/geofences")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send(geofence)
                .end((req, res) => {
                    delete res.body.result.geofenceId;
                    expect(res.body).toEqual({
                        success: true,
                        result: {
                            message: "Created geofence",
                        },
                    });
                    done();
                });
        }, 1000);

        test("cannot create geofences for people you do not follow", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            const geofence = {
                address: "123 main st.",
                username: "coche",
                lat: 12.3,
                lon: -98.2,
                name: "work",
                radius: 50,
            };

            request(service.router)
                .post("/geofences")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send(geofence)
                .expect(501)
                .end((req, res) => {
                    delete res.body.result.geofenceId;
                    expect(res.body).toEqual({
                        success: false,
                        result: {
                            engineeringError: "Unable to create geofence",
                            message: "Unable to create geofence",
                        },
                    });
                    done();
                });
        }, 1000);

        test("owner can delete geofence", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            const geofence = {
                address: "123 main st.",
                username: "dario",
                lat: 12.3,
                lon: -98.2,
                name: "work",
                radius: 50,
            };

            const { body } = await request(service.router)
                .post("/geofences")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send(geofence)
                .expect(200);

            request(service.router)
                .get("/geofences")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send({})
                .end((req, res) => expect(res.body.result.mine.length).toBe(1));

            await request(service.router)
                .delete(`/geofences/${body.result.geofenceId}`)
                .set(JWT_HEADER_TOKEN, darioToken)
                .send({})
                .expect(200);

            request(service.router)
                .get("/geofences")
                .set(JWT_HEADER_TOKEN, darioToken)
                .send({})
                .end((req, res) => {
                    expect(res.body.result.mine.length).toBe(0);
                    done();
                });
        }, 1000);

        test("non-owner cannot delete geofence", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            await registerPublicKey2(
                { username: "coche", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );

            const geofence = {
                address: "123 main st.",
                username: "coche",
                lat: 12.3,
                lon: -98.2,
                name: "work",
                radius: 50,
            };

            const { body } = await request(service.router)
                .post("/geofences")
                .set(JWT_HEADER_TOKEN, cocheToken)
                .send(geofence)
                .expect(200);

            request(service.router)
                .get("/geofences")
                .set(JWT_HEADER_TOKEN, cocheToken)
                .send({})
                .end((req, res) => expect(res.body.result.mine.length).toBe(1));

            request(service.router)
                .delete(`/geofences/${body.result.geofenceId}`)
                .set(JWT_HEADER_TOKEN, darioToken)
                .send({})
                .expect(403)
                .end((req, res) =>
                    expect(res.body).toEqual({
                        success: false,
                        result: { message: "Unable to delete geofence" },
                    }),
                );

            request(service.router)
                .get("/geofences")
                .set(JWT_HEADER_TOKEN, cocheToken)
                .send({})
                .end((req, res) => {
                    expect(res.body.result.mine.length).toBe(1);
                    done();
                });
        }, 1000);
    });

    describe("/geofences/subscribe/:geofenceId", () => {
        let service: HTTPGateway;

        beforeEach(async () => {
            await dbmate_rebuild();
            service = new HTTPGateway(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                pgConfig,
                {},
                storageOptions,
            );
            await service.start();
        });

        afterEach((done) => {
            service.stop();
            done();
        });

        test("no token returns 403", async (done) => {
            request(service.router).post("/geofences/subscribe/3").send({}).expect(403, done);
        }, 1000);

        test("must follow user to subscribe to geofence", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );

            const geofenceId = await createGeofence(
                "griffin",
                {
                    address: "123 main st.",
                    username: "griffin",
                    lat: 12.3,
                    lon: -98.2,
                    name: "work",
                    radius: 50,
                },
                service.pgClient,
            );

            request(service.router)
                .post(`/geofences/subscribe/${geofenceId}`)
                .set(JWT_HEADER_TOKEN, darioToken)
                .send()
                .expect(403)
                .end((req, res) => {
                    expect(res.body).toEqual({
                        success: false,
                        result: {
                            engineeringError: "Unable to subscribe to the geofence",
                            message: "Unable to subscribe to the geofence",
                        },
                    });
                    done();
                });
        }, 1000);
    });

    describe("/geofences/unsubscribe/:geofenceId", () => {
        let service: HTTPGateway;

        beforeEach(async () => {
            await dbmate_rebuild();
            service = new HTTPGateway(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                pgConfig,
                {},
                storageOptions,
            );
            await service.start();
        });

        afterEach((done) => {
            service.stop();
            done();
        });

        test("no token returns 403", async (done) => {
            request(service.router).post("/geofences/unsubscribe/3").send({}).expect(403, done);
        }, 1000);

        test("user can unsubscribe from a geofence that they are subscribed to", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .post(`/geofences/unsubscribe/2`)
                .set(JWT_HEADER_TOKEN, darioToken)
                .send()
                .end((req, res) => {
                    expect(res.body).toEqual({
                        success: true,
                        result: {
                            message: "Unsubscribed from geofence",
                        },
                    });
                    done();
                });
        }, 1000);
    });

    describe("/me/connections/following/:username/telemetry", () => {
        let service: HTTPGateway;
        const users = new Array(3).fill(0, 0, 3).map((value, index) => index);
        let db: DBClientWithConnection;
        let tokens: string[];

        beforeEach(async () => {
            await dbmate_rebuild();
            service = new HTTPGateway(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                pgConfig,
                {},
                storageOptions,
            );
            await service.start();
            db = await withDB(service.pgClient);
            tokens = await Promise.all(
                users.map(async (i) => {
                    const username = `user${i}`;
                    const deviceId = `${username}_iphone`;
                    await registerWithEmail(
                        {
                            username,
                            publicKey: `pk`,
                            email: `user${i}@fakemail.com`,
                            firstName: "Lalo",
                            lastName: "Landa",
                            picture: undefined,
                            language: "en",
                        },
                        db,
                    );
                    await registerDevice(
                        {
                            username,
                            os: "Android",
                            osVersion: "34",
                            appVersion: "14",
                            deviceId,
                            model: "Model",
                        },
                        service.pgClient,
                    );
                    await registerPublicKey2(
                        { username: `user${i}`, publicKey: MOCK_PUBLIC_KEY },
                        service.pgClient,
                    );
                    return generateJwtTokenHelper(MOCK_PRIVATE_KEY, {
                        username,
                        deviceId,
                    });
                }),
            );
        });

        afterEach((done) => {
            service.stop();
            done();
        });

        test("no token returns 403", async (done) => {
            request(service.router)
                .get("/me/connections/following/123/telemetry")
                .send({})
                .expect(403, done);
        }, 1000);

        test("cant get historical location for a person that I do not follow", async (done) => {
            const token = tokens[0];
            request(service.router)
                .get(
                    "/me/connections/following/user1/telemetry?startTime=2019-12-11T00:49:58.642Z&endTime=2020-12-11T00:49:58.642Z",
                )
                .set(JWT_HEADER_TOKEN, token)
                .send({})
                .end((req, res) => {
                    expect(res.status).toEqual(401);
                    expect(res.body).toEqual({
                        success: false,
                        result: {
                            message: "user0 does not follow user1",
                            engineeringError: "user0 does not follow user1",
                        },
                    });
                    done();
                });
        }, 1000);

        test("cant get historical location for a person that is not in emer", async (done) => {
            const token = tokens[0];
            const targetUsername = `user0`;

            await createInvitation(
                invitationForUser("user1", `${targetUsername}@fakemail.com`),
                db,
            );

            const { received } = await getInvitations(
                { username: targetUsername },
                service.pgClient,
            );
            expect(received.length).toEqual(1);
            const invitation = received[0];
            await acceptFollowerInvitation({ username: targetUsername, id: invitation.id }, db);
            request(service.router)
                .get(
                    "/me/connections/following/user1/telemetry?startTime=2019-12-11T00:49:58.642Z&endTime=2020-12-11T00:49:58.642Z",
                )
                .set(JWT_HEADER_TOKEN, token)
                .send({})
                .end((req, res) => {
                    expect(res.status).toEqual(401);
                    expect(res.body).toEqual({
                        success: false,
                        result: {
                            engineeringError: "User is not in an emergency, user1",
                            message:
                                "user1 is not in an emergency, historical location tracking is disabled.",
                        },
                    });
                    done();
                });
        }, 1000);

        test("can get historical location for a person that is in emer", async (done) => {
            const token = tokens[0];
            const targetUsername = `user0`;

            await createInvitation(
                invitationForUser("user1", `${targetUsername}@fakemail.com`),
                db,
            );

            const { received } = await getInvitations(
                { username: targetUsername },
                service.pgClient,
            );
            expect(received.length).toEqual(1);
            const invitation = received[0];
            await acceptFollowerInvitation({ username: targetUsername, id: invitation.id }, db);
            await updateUserState(
                {
                    username: "user1",
                    newState: UserState.Emergency,
                },
                db,
            );

            const insertQuery = `insert into device_telemetry
            (username, device_id, recipient_username, encrypted_location, creation_timestamp)
            values ($1, $2, $3, $4, $5)`;

            await db.connection.query(insertQuery, [
                "user1",
                "user1_iphone",
                "user0",
                "encryptedData",
                new Date("2020-01-01T00:49:58.642Z"),
            ]);

            await db.connection.query(insertQuery, [
                "user1",
                "user1_iphone",
                "user1",
                "encryptedData",
                new Date("2020-01-01T00:49:58.642Z"),
            ]);

            await db.connection.query(insertQuery, [
                "user1",
                "user1_iphone",
                "user2",
                "encryptedData",
                new Date("2020-01-01T00:49:58.642Z"),
            ]);

            request(service.router)
                .get(
                    "/me/connections/following/user1/telemetry?startTime=2019-12-11T00:49:58.642Z&endTime=2020-12-11T00:49:58.642Z",
                )
                .set(JWT_HEADER_TOKEN, token)
                .send({})
                .end((req, res) => {
                    expect(res.status).toEqual(200);
                    expect(res.body).toEqual({
                        success: true,
                        result: [
                            {
                                data: "encryptedData",
                                deviceId: "user1_iphone",
                                timestamp: "2020-01-01T00:49:58.642Z",
                            },
                        ],
                    });
                    done();
                });
        }, 1000);
    });
});
