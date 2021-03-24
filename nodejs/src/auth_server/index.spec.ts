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

import amqp from "amqplib";
import request from "supertest";
import getPort from "get-port";
import sinon, { SinonFakeTimers } from "sinon";
import { ClientConfig } from "pg";
import isEqual from "lodash/isEqual";

import {
    JWT_HEADER_TOKEN,
    PG_URL,
    JWT_CUSTOMER_ALGORITHM,
    RABBIT_MQ_URL_WITH_CREDS,
    WEB_URL,
} from "../common/constants";
import { AuthServer } from "./index";
import { dbmate_rebuild } from "../common/dbmate";
import {
    generateJwtTokenHelper,
    MOCK_PRIVATE_KEY,
    MOCK_PUBLIC_KEY,
} from "../common/authentication";
import { RabbitClient } from "../common/rabbit-helpers";
import { notificationsExchange } from "../common/rabbit-constants";
import { ACCEPT_LANGUAGE_HTTP_HEADER } from "../common/localization/localization";
import { removeFields } from "../http_gateway/index.spec";
import { deleteDevice } from "../common/db/device-management";
import { withDB } from "../common/db/db";
import { registerPublicKey2, register } from "../common/db/authentication";
import { waitForCondition } from "../common/test_utils";
import { notificationsServerQueue } from "../notification_server";
import { logger } from "../common/logger";
import { after } from "lodash";
import { assert } from "console";

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

describe("AuthServer", () => {
    describe("delete", () => {
        const token = generateJwtTokenHelper(MOCK_PRIVATE_KEY, {
            username: "dario",
            deviceId: "dario_iphone",
        });
        let service: AuthServer;

        beforeEach(async () => {
            await dbmate_rebuild();
            service = new AuthServer(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                JWT_CUSTOMER_ALGORITHM,
                pgConfig,
                storageOptions,
            );
            await service.start();
        });

        afterEach((done) => {
            service.stop();
            done();
        });

        it("invalid payload returns 403", async (done) => {
            request(service.router).delete("/me/devices/dario_iphone").send({}).expect(403, done);
        }, 1000);

        it("delete a device from account", async (done) => {
            expect(
                (
                    await service.pgClient.connection!.query(
                        `SELECT device_id from users_devices where username = 'dario'`,
                    )
                ).rowCount,
            ).toEqual(1);
            expect(
                (
                    await service.pgClient.connection!.query(
                        `SELECT device_id from devices where device_id = 'dario_iphone'`,
                    )
                ).rowCount,
            ).toEqual(1);
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .delete("/me/devices/dario_iphone")
                .set(JWT_HEADER_TOKEN, token)
                .send()
                .end(async (err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Success, the device was deleted.",
                        },
                        success: true,
                    });
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                `SELECT device_id from users_devices where username = 'dario'`,
                            )
                        ).rowCount,
                    ).toEqual(0);
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                `SELECT device_id from devices where device_id = 'dario_iphone'`,
                            )
                        ).rowCount,
                    ).toEqual(0);
                    done();
                });
        }, 1000);

        it("delete a device from account that you do not own", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .delete("/me/devices/b526979c-cade-4198-8fa4-fb077ef7544f")
                .set(JWT_HEADER_TOKEN, token)
                .send()
                .end(async (err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            engineeringError: "User does not own the device or it does not exist",
                            message:
                                "The phone sent a bad request, this is an app error and has been logged",
                        },
                        success: false,
                    });
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                `SELECT device_id from users_devices where username = 'dario'`,
                            )
                        ).rowCount,
                    ).toEqual(1);
                    done();
                });
        }, 1000);

        it("delete a device that does not exist", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .delete("/me/devices/patrick_bet_david ")
                .set(JWT_HEADER_TOKEN, token)
                .send()
                .end(async (err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Success, the device was deleted.",
                        },
                        success: true,
                    });
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                `SELECT device_id from users_devices where username = 'dario'`,
                            )
                        ).rowCount,
                    ).toEqual(1);
                    done();
                });
        }, 1000);
    });

    describe("login", () => {
        let service: AuthServer;
        let rabbit: RabbitClient;

        beforeAll(async () => {
            await dbmate_rebuild();
            service = new AuthServer(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                JWT_CUSTOMER_ALGORITHM,
                pgConfig,
                storageOptions,
            );
            await service.start();

            rabbit = new RabbitClient(
                RABBIT_MQ_URL_WITH_CREDS(),
                [notificationsExchange],
                notificationsServerQueue,
            );
            await rabbit.start();
        });

        afterAll(async () => {
            await service.stop();
            await rabbit.close();
        });

        it("invalid login payload returns 400", async (done) => {
            request(service.router).post("/login").send({}).expect(400, done);
        }, 1000);

        it("simple login to create verification request works", async (done) => {
            let currentMessage: any = undefined;
            // 1. Setup rabbitmq sub to intercept invitation created and accepted messages.
            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });

            request(service.router)
                .post("/login")
                .send({
                    email: "darioalessandrolencina@gmail.com",
                    publicKey: "abc",
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Successfully created verification request",
                        },
                        success: true,
                    });
                });

            await waitForCondition({
                timeoutMs: 3000,
                pollPeriodMs: 100,
                errorToThrow: () =>
                    new Error(
                        `did not receive the correct invitation create, got ${JSON.stringify(
                            currentMessage,
                        )} `,
                    ),
                callback: () =>
                    isEqual(removeFields(currentMessage, ["code", "link"]), [
                        removeFields(
                            {
                                email: "darioalessandrolencina@gmail.com",
                                templateId: "d-fac72b3d96894b5bb5a0f5944102f891",
                                subject: "Armore: Email Verification Required",
                                dynamicTemplateData: {
                                    title: "Email Verification Required",
                                    body:
                                        "Hello Dario, please click the link below or use the code to verify that you are the owner of this account.",
                                    linkTitle: "Verify",
                                    code: "Sa7El",
                                    link: "https://armore.dev/user/verify/Sa7El",
                                },
                            },
                            ["code", "link"],
                        ),
                    ]),
            });
            done();
        }, 1000);

        it("simple login to create verification request works with phone number", async (done) => {
            request(service.router)
                .post("/login")
                .send({
                    phoneNumber: "8888888888",
                    publicKey: "abc",
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Successfully created verification request",
                        },
                        success: true,
                    });
                });
            done();
        }, 1000);

        it("simple login to create verification request works with email case insensitive", async (done) => {
            let currentMessage: any = undefined;
            // 1. Setup rabbitmq sub to intercept invitation created and accepted messages.
            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });

            request(service.router)
                .post("/login")
                .send({
                    email: "DarioAlessandroLencina@gmail.com",
                    publicKey: "abc",
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Successfully created verification request",
                        },
                        success: true,
                    });
                });

            await waitForCondition({
                timeoutMs: 3000,
                pollPeriodMs: 100,
                errorToThrow: () =>
                    new Error(
                        `did not receive the correct invitation create, got ${JSON.stringify(
                            currentMessage,
                        )} `,
                    ),
                callback: () =>
                    isEqual(removeFields(currentMessage, ["code", "link"]), [
                        removeFields(
                            {
                                email: "darioalessandrolencina@gmail.com",
                                templateId: "d-fac72b3d96894b5bb5a0f5944102f891",
                                subject: "Armore: Email Verification Required",
                                dynamicTemplateData: {
                                    title: "Email Verification Required",
                                    body:
                                        "Hello Dario, please click the link below or use the code to verify that you are the owner of this account.",
                                    linkTitle: "Verify",
                                    code: "Sa7El",
                                    link: "https://armore.dev/user/verify/Sa7El",
                                },
                            },
                            ["code", "link"],
                        ),
                    ]),
            });
            done();
        }, 1000);

        it("login fails to create verification request for invalid email", async (done) => {
            request(service.router)
                .post("/login")
                .send({
                    email: "darioasdfflencina@gmail.com",
                    publicKey: "abc",
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            engineeringError: "Unable to fetch user info",
                            message:
                                "Internal server error. An engineer has been notified and we will solve this asap.",
                        },
                        success: false,
                    });
                    done();
                });
        }, 1000);
    });

    describe("register", () => {
        let service: AuthServer;
        let rabbit: RabbitClient;

        beforeEach(async () => {
            await dbmate_rebuild();
            service = new AuthServer(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                JWT_CUSTOMER_ALGORITHM,
                pgConfig,
                storageOptions,
            );
            await service.start();

            rabbit = new RabbitClient(
                RABBIT_MQ_URL_WITH_CREDS(),
                [notificationsExchange],
                notificationsServerQueue,
            );
            await rabbit.start();
        });

        afterEach(async () => {
            await service.stop();
            await rabbit.close();
        });

        test("rejects invalid registration payload", (done) => {
            request(service.router)
                .post("/register")
                .send({
                    username: "dario1",
                    password: "w0MF57NfbwvfTqrLEPjhR9zSunkVIeQkhjpIvZV8Vek=",
                    os: "Android",
                    osVersion: "13",
                    deviceId: "213213213213",
                    model: "model",
                })
                .end((err, res) => {
                    expect(res.status).toEqual(400);
                    done();
                });
        });

        test("accepts valid registration payload", async (done) => {
            let currentMessages: any[] = [];
            // 1. Setup rabbitmq sub to intercept invitation created and accepted messages.
            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                rabbit.channel?.ack(msg);
                currentMessages = currentMessages.concat(JSON.parse(msg.content.toString()));
            });
            request(service.router)
                .post("/register")
                .send({
                    username: "dario1",
                    email: "derp@gmail.com",
                    firstName: "Dario",
                    lastName: "Talarico",
                    publicKey: "panteritaBoo",
                })
                .end(async (err, res) => {
                    expect(res.body).toEqual({
                        success: true,
                        result: {
                            message: "Successfully created verification request",
                        },
                    });
                    expect(res.status).toEqual(200);
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                "SELECT * from user_details where username = 'dario1'",
                            )
                        ).rowCount,
                    ).toEqual(1);
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                "SELECT * from users_state where username = 'dario1'",
                            )
                        ).rowCount,
                    ).toEqual(1);
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                "SELECT * from users_settings where username = 'dario1'",
                            )
                        ).rowCount,
                    ).toEqual(1);
                });

            await waitForCondition({
                timeoutMs: 3000,
                pollPeriodMs: 100,
                errorToThrow: () =>
                    new Error(
                        `did not receive the correct verification code, got ${JSON.stringify(
                            currentMessages,
                        )} `,
                    ),
                callback: () =>
                    isEqual(
                        removeFields(currentMessages, ["code", "link"]),
                        removeFields(
                            [
                                {
                                    email: "derp@gmail.com",
                                    templateId: "d-fac72b3d96894b5bb5a0f5944102f891",
                                    subject: "Armore: Email Verification Required",
                                    dynamicTemplateData: {
                                        title: "Email Verification Required",
                                        body:
                                            "Hello Dario, please click the link below or use the code to verify that you are the owner of this account.",
                                        linkTitle: "Verify",
                                        code: "f232F",
                                        link: "https://armore.dev/user/verify/f232F",
                                    },
                                },
                            ],
                            ["code", "link"],
                        ),
                    ),
            });
            done();
        });

        test("accepts valid registration payload with caps", async (done) => {
            let currentMessages: any[] = [];
            // 1. Setup rabbitmq sub to intercept invitation created and accepted messages.
            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                rabbit.channel?.ack(msg);
                currentMessages = currentMessages.concat(JSON.parse(msg.content.toString()));
            });
            request(service.router)
                .post("/register")
                .send({
                    username: "Dario1",
                    email: "Derp@gmail.com",
                    firstName: "Dario",
                    lastName: "Talarico",
                    publicKey: "panteritaBoo",
                })
                .end(async (err, res) => {
                    expect(res.body).toEqual({
                        success: true,
                        result: {
                            message: "Successfully created verification request",
                        },
                    });
                    expect(res.status).toEqual(200);
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                "SELECT * from users_verification where email = 'derp@gmail.com'",
                            )
                        ).rowCount,
                    ).toEqual(1);
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                "SELECT * from user_details where username = 'dario1'",
                            )
                        ).rowCount,
                    ).toEqual(1);
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                "SELECT * from users_state where username = 'dario1'",
                            )
                        ).rowCount,
                    ).toEqual(1);
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                "SELECT * from users_settings where username = 'dario1'",
                            )
                        ).rowCount,
                    ).toEqual(1);
                });

            await waitForCondition({
                timeoutMs: 3000,
                pollPeriodMs: 100,
                errorToThrow: () =>
                    new Error(
                        `did not receive the correct verification code, got ${JSON.stringify(
                            currentMessages,
                        )} `,
                    ),
                callback: () =>
                    isEqual(
                        removeFields(currentMessages, ["code", "link"]),
                        removeFields(
                            [
                                {
                                    email: "derp@gmail.com",
                                    templateId: "d-fac72b3d96894b5bb5a0f5944102f891",
                                    subject: "Armore: Email Verification Required",
                                    dynamicTemplateData: {
                                        title: "Email Verification Required",
                                        body:
                                            "Hello Dario, please click the link below or use the code to verify that you are the owner of this account.",
                                        linkTitle: "Verify",
                                        code: "f232F",
                                        link: "https://armore.dev/user/verify/f232F",
                                    },
                                },
                            ],
                            ["code", "link"],
                        ),
                    ),
            });
            done();
        });

        test("accepts valid registration payload with phone number", async (done) => {
            let currentMessages: any[] = [];
            // 1. Setup rabbitmq sub to intercept invitation created and accepted messages.
            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                rabbit.channel?.ack(msg);
                currentMessages = currentMessages.concat(JSON.parse(msg.content.toString()));
            });
            request(service.router)
                .post("/register")
                .send({
                    username: "dario1",
                    phoneNumber: "8888888888",
                    firstName: "Dario",
                    lastName: "Talarico",
                    publicKey: "panteritaBoo",
                })
                .end(async (err, res) => {
                    expect(res.body).toEqual({
                        success: true,
                        result: {
                            message: "Successfully created verification request",
                        },
                    });
                    expect(res.status).toEqual(200);
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                "SELECT * from users_verification where phone_number = '+18888888888'",
                            )
                        ).rowCount,
                    ).toEqual(1);
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                "SELECT * from user_details where username = 'dario1'",
                            )
                        ).rowCount,
                    ).toEqual(1);
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                "SELECT * from users_state where username = 'dario1'",
                            )
                        ).rowCount,
                    ).toEqual(1);
                    expect(
                        (
                            await service.pgClient.connection!.query(
                                "SELECT * from users_settings where username = 'dario1'",
                            )
                        ).rowCount,
                    ).toEqual(1);
                });

            await waitForCondition({
                timeoutMs: 3000,
                pollPeriodMs: 100,
                errorToThrow: () =>
                    new Error(
                        `did not receive the correct verification code, got ${JSON.stringify(
                            currentMessages,
                        )} `,
                    ),
                callback: () =>
                    isEqual(
                        removeFields(currentMessages, ["body"]),
                        removeFields(
                            [
                                {
                                    to: "+18888888888",
                                    body: `Your Armore verification code is: f232F\n${WEB_URL}/user/verify/f232F`,
                                },
                            ],
                            ["body"],
                        ),
                    ),
            });
            done();
        });
    });

    describe("me", () => {
        let service: AuthServer;
        let clock: SinonFakeTimers;
        const token = generateJwtTokenHelper(MOCK_PRIVATE_KEY, {
            username: "dario",
            deviceId: "dario_iphone",
        });

        beforeEach(async () => {
            await dbmate_rebuild();
            clock = sinon.useFakeTimers(new Date(1559008535240)); // freeze time so that jwt token never expires.
            service = new AuthServer(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                JWT_CUSTOMER_ALGORITHM,
                pgConfig,
                storageOptions,
            );
            await service.start();
        });

        afterEach((done) => {
            service.stop();
            clock.restore();
            done();
        });

        it("invalid /me payload returns 403", async (done) => {
            request(service.router).get("/me").send({}).expect(403, done);
        }, 1000);

        it("valid /me payload returns 200", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .get("/me")
                .set(JWT_HEADER_TOKEN, token)
                .send()
                .end((err, res) => {
                    expect(res.body.success).toBeTruthy();
                    expect(res.status).toEqual(200);
                    done();
                });
        }, 1000);

        it("valid /me payload with different language returns 200", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .get("/me")
                .set(JWT_HEADER_TOKEN, token)
                .set(ACCEPT_LANGUAGE_HTTP_HEADER, "fr")
                .send()
                .end((err, res) => {
                    expect(res.status).toEqual(200);
                    expect(res.body).toEqual({
                        result: {
                            email: "darioalessandrolencina@gmail.com",
                            phoneNumber: undefined,
                            firstName: "Dario",
                            language: "fr",
                            lastName: "Lencina-Talarico",
                            picture: "predator.png",
                            settings: {
                                followersNeededToDeclareEmergency: 2,
                            },
                            userState: {
                                followersPerception: [
                                    {
                                        perception: "Normal",
                                        username: "billburr",
                                    },
                                    {
                                        perception: "Normal",
                                        username: "louisck",
                                    },
                                ],
                                selfPerceptionState: "Normal",
                            },
                            username: "dario",
                        },
                        success: true,
                    });
                    done();
                });
        }, 1000);

        it("valid /me payload returns 200 with iOS token", async (done) => {
            const darioiOSJWTToken =
                "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2ODg0ODE4NjUsInVzZXJuYW1lIjoiZGF" +
                "yaW8iLCJkZXZpY2VJZCI6IjU0RUIxNDc1LUY1QzItNDk0Qy1BMTJBLUE3QzYzQTNFRTFENSJ9.iHiylcF33GblkrNYFIl_jEOH26h" +
                "ohEMsH3YW4OBKwdD2ScMZJPwMbo4X2QZfM_ktUbmFMIauGE8ENq8au1pCRy41BIIAkZbWcN7Y8d4t-jdUsCIql6W0i9-vuLcd32MJ" +
                "owkb1Xbnh6yUL3oloO7VkBKgWzWlipnNy5Z5O11wzHEythjwSbKADtWYiHpIj__fzrlvQH1lVZP4OW5FT-DYnp1ik91RlvPp9q3fU" +
                "iR_zi1w1u8wu79v6S4ixVbDs9qdFSnFNYWAdJgiXpdUgKHT6EyXOAnnXu6NdhZGAgaAMgbOGiiP7EibABn1KLd9xhFplCzhdYPhAE" +
                "ctv4HAfJqcng9tLWGnssgR0C_rBAa5uv0kpXBSWqgPvk3u4mfoqdS0GfH3EPHZ2goHdkR79mih2D1BHx3TqMuN7YfrFCrfjuNtlmv" +
                "6BrjDnjXS34rUAWHQxL6odkr1-STfgr4QSuEFnHrSoLi-sCxVdqyyhYkeMw0PBKXLZCL6uFIqxdP1oneb-VR7pJtXV9PqVTRwevX4" +
                "kZVplcRsi-SDIiWwrXaNAY4iFEH8qr2smNmPsXbeBjVL9QkXbV2AWPTdIxqWdk98Wqniz3_OofjuYLsLJr_1tUycEhWYoGTgzybMZ" +
                "jhs1TiAcE4GK21dNtxxFGMZUFqHtAU0ch4SDd8p8QZOqrrw97Y";
            const darioiOSPublicKey =
                "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAsmNN5+1neskuKCgwFGOEydHb3uj2DrR6\n" +
                "KzK9+FpXma2KIrMuNLiLNWaXaB4AdFv2ag7KSx4G54QKcYOqJ3l0Z5Ikjc61TKmWILCxUaC0W/+o\n" +
                "lHo2Mm0KzCCgtikziDw0vQXm1sEBKzkp8VGT3okbRe24JnCwwhnpr+cdRt6ZYVwBC14s2hR6RK/P\n" +
                "x+9lsJsqW6jbfYmJX9Vkl1UkWiNEMequ2FN6WC/QOrFvR1zgsjgG/Fkgti/vzHRvE7hp08kW7s8k\n" +
                "kLpIx10lgHBWl0g+LjtssJpZWfh3P9crlnOj3G7yjT+Mzh01vKkaQAJZUdh3Bq/XXHdzeV7jZ2G6\n" +
                "2y7JjZepxM//sQ0sb5LqIBPWZgtKjvadTwD4zcrVLO3pgxKaAsrRUzPgz1hFOmCbgWnMqQ9zhwjw\n" +
                "Uj4rFpfnyeFouJgfaBGJGRi2o7IKIRK5iIpajFfpKvR2/cNiuLA/VtfcAe6q/xzggwtNotWvosxJ\n" +
                "9f/xfsiaeLoBE3Tsyw9+U/nOmTWQyaLyC2/LItkTyI5FnaL8I8KzKm/kIH9o7GU0Xnikkhxp24rG\n" +
                "xirKDF7Mb9xEIFpx58R1vDvSSpm7GmzxBK8N7zCDdIFWHA28NZTNglZ9AUEvXjU/reBGOuDqkCQk\n" +
                "CbpckN4uW6rlrdzQYToPZHEEZwS79L3f7mSw/N6zAjkCAwEAAQ==";
            await registerPublicKey2(
                { username: "dario", publicKey: darioiOSPublicKey },
                service.pgClient,
            );
            request(service.router)
                .get("/me")
                .set(JWT_HEADER_TOKEN, darioiOSJWTToken)
                .send()
                .end((err, res) => {
                    expect(res.body.success).toBeTruthy();
                    expect(res.status).toEqual(200);
                    done();
                });
        }, 1000);

        it("PATCH /me without a valid token returns 403", async (done) => {
            request(service.router).patch("/me").send({}).expect(403, done);
        }, 1000);

        it("PATCH /me with an empty body returns an error", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .patch("/me")
                .set(JWT_HEADER_TOKEN, token)
                .send({})
                .end((err, res) => {
                    expect(res.body.success).toBeFalsy();
                    expect(res.status).toEqual(400);
                    done();
                });
        }, 1000);

        it("PATCH /me with an invalid base64 string for picture returns error", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .patch("/me")
                .set(JWT_HEADER_TOKEN, token)
                .send({
                    picture: "33Ñńń",
                })
                .end((err, res) => {
                    expect(res.body.success).toBeFalsy();
                    expect(res.status).toEqual(400);
                    done();
                });
        }, 1000);

        it("PATCH /me update first name and last name", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .patch("/me")
                .set(JWT_HEADER_TOKEN, token)
                .send({
                    firstName: "Dario2.0",
                    lastName: "Lencina-Talarico-v2",
                })
                .end((_err, res) => {
                    expect(res.status).toEqual(200);
                    expect(res.body).toEqual({
                        success: true,
                        result: {
                            email: "darioalessandrolencina@gmail.com",
                            phoneNumber: undefined,
                            firstName: "Dario2.0",
                            language: "en",
                            lastName: "Lencina-Talarico-v2",
                            picture: "predator.png",
                            settings: {
                                followersNeededToDeclareEmergency: 2,
                            },
                            userState: {
                                followersPerception: [
                                    {
                                        perception: "Normal",
                                        username: "billburr",
                                    },
                                    {
                                        perception: "Normal",
                                        username: "louisck",
                                    },
                                ],
                                selfPerceptionState: "Normal",
                            },
                            username: "dario",
                        },
                    });
                    done();
                });
        }, 1000);

        it("PATCH /me update phone number with good format", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .patch("/me")
                .set(JWT_HEADER_TOKEN, token)
                .send({
                    phoneNumber: "+15179181234",
                })
                .end((_err, res) => {
                    expect(res.status).toEqual(200);
                    expect(res.body).toEqual({
                        success: true,
                        result: {
                            email: "darioalessandrolencina@gmail.com",
                            phoneNumber: "+15179181234",
                            firstName: "Dario",
                            language: "en",
                            lastName: "Lencina-Talarico",
                            picture: "predator.png",
                            settings: {
                                followersNeededToDeclareEmergency: 2,
                            },
                            userState: {
                                followersPerception: [
                                    {
                                        perception: "Normal",
                                        username: "billburr",
                                    },
                                    {
                                        perception: "Normal",
                                        username: "louisck",
                                    },
                                ],
                                selfPerceptionState: "Normal",
                            },
                            username: "dario",
                        },
                    });
                    done();
                });
        }, 1000);

        it("PATCH /me update phone number with bad format", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .patch("/me")
                .set(JWT_HEADER_TOKEN, token)
                .send({
                    phoneNumber: "88888888",
                })
                .end((_err, res) => {
                    expect(res.status).toEqual(400);
                    expect(res.body.success).toBeFalsy();
                    done();
                });
        }, 1000);

        it("PATCH /me update email with good format", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .patch("/me")
                .set(JWT_HEADER_TOKEN, token)
                .send({
                    email: "griffin@gmail.com",
                })
                .end((_err, res) => {
                    expect(res.status).toEqual(200);
                    expect(res.body).toEqual({
                        success: true,
                        result: {
                            email: "griffin@gmail.com",
                            phoneNumber: undefined,
                            firstName: "Dario",
                            language: "en",
                            lastName: "Lencina-Talarico",
                            picture: "predator.png",
                            settings: {
                                followersNeededToDeclareEmergency: 2,
                            },
                            userState: {
                                followersPerception: [
                                    {
                                        perception: "Normal",
                                        username: "billburr",
                                    },
                                    {
                                        perception: "Normal",
                                        username: "louisck",
                                    },
                                ],
                                selfPerceptionState: "Normal",
                            },
                            username: "dario",
                        },
                    });
                    done();
                });
        }, 1000);

        it("PATCH /me update email with bad format", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .patch("/me")
                .set(JWT_HEADER_TOKEN, token)
                .send({
                    email: "abc@$@!@#asd@acas.net",
                })
                .end((_err, res) => {
                    expect(res.status).toEqual(400);
                    expect(res.body.success).toBeFalsy();
                    done();
                });
        }, 1000);

        it("PATCH /me with a base64 string returns success", async (done) => {
            await registerPublicKey2(
                { username: "dario", publicKey: MOCK_PUBLIC_KEY },
                service.pgClient,
            );
            request(service.router)
                .patch("/me")
                .set(JWT_HEADER_TOKEN, token)
                .send({
                    picture: "QUJDREFXRUUK",
                })
                .end((_err, res) => {
                    expect(res.body.result.picture).toBeTruthy();
                    expect(removeFields(res.body, ["picture"])).toEqual(
                        removeFields(
                            {
                                success: true,
                                result: {
                                    email: "darioalessandrolencina@gmail.com",
                                    phoneNumber: undefined,
                                    firstName: "Dario",
                                    language: "en",
                                    lastName: "Lencina-Talarico",
                                    picture: "predator.png",
                                    settings: {
                                        followersNeededToDeclareEmergency: 2,
                                    },
                                    userState: {
                                        followersPerception: [
                                            {
                                                perception: "Normal",
                                                username: "billburr",
                                            },
                                            {
                                                perception: "Normal",
                                                username: "louisck",
                                            },
                                        ],
                                        selfPerceptionState: "Normal",
                                    },
                                    username: "dario",
                                },
                            },
                            ["picture"],
                        ),
                    );
                    done();
                });
        }, 1000);
    });

    describe("userExists", () => {
        let service: AuthServer;

        beforeAll(async () => {
            await dbmate_rebuild();
            service = new AuthServer(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                JWT_CUSTOMER_ALGORITHM,
                pgConfig,
                storageOptions,
            );
            await service.start();
        });

        afterAll((done) => {
            service.stop();
            done();
        });

        test("returns true if user exists with email", async (done) => {
            request(service.router)
                .get("/user/exists/darioalessandrolencina@gmail.com")
                .send()
                .end((err, res) => {
                    expect(res.body.success).toBeTruthy();
                    expect(res.body.result.exists).toEqual(true);
                    expect(res.status).toEqual(200);
                    done();
                });
        }, 1000);

        test("returns true if user exists with email ignore caps", async (done) => {
            request(service.router)
                .get("/user/exists/DarioAlessandroLencina@Gmail.com")
                .send()
                .end((err, res) => {
                    expect(res.body.success).toBeTruthy();
                    expect(res.body.result.exists).toEqual(true);
                    expect(res.status).toEqual(200);
                    done();
                });
        }, 1000);

        test("returns false if user with email does not exist", async (done) => {
            request(service.router)
                .get("/user/exists/darioalessandrolencina@gail.com")
                .send()
                .end((err, res) => {
                    expect(res.body.success).toBeTruthy();
                    expect(res.body.result.exists).toEqual(false);
                    expect(res.status).toEqual(201);
                    done();
                });
        }, 1000);

        test("returns false if phone number is sent", async (done) => {
            const phoneNumber = "+18888888888";
            await withDB(service.pgClient).then((db) =>
                register(
                    {
                        username: "abhgf",
                        firstName: "abhgf",
                        lastName: "abhgf",
                        picture: undefined,
                        publicKey: "pktest",
                        language: "en",
                    },
                    db,
                ),
            );
            request(service.router)
                .get(`/user/exists/${phoneNumber}`)
                .send()
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            engineeringError: "email with value '+18888888888' is invalid",
                            message: "email with value '+18888888888' is invalid",
                        },
                        success: false,
                    });
                    expect(res.body.success).toBeFalsy();
                    expect(res.status).toEqual(400);
                    done();
                });
        }, 1000);
    });

    describe("userExistsWithEmail", () => {
        let service: AuthServer;

        beforeAll(async () => {
            await dbmate_rebuild();
            service = new AuthServer(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                JWT_CUSTOMER_ALGORITHM,
                pgConfig,
                storageOptions,
            );
            await service.start();
        });

        afterAll((done) => {
            service.stop();
            done();
        });

        test("returns true if user exists with email", async (done) => {
            request(service.router)
                .get("/user/exists/email/darioalessandrolencina@gmail.com")
                .send()
                .end((err, res) => {
                    expect(res.body.success).toBeTruthy();
                    expect(res.body.result.exists).toEqual(true);
                    expect(res.status).toEqual(200);
                    done();
                });
        }, 1000);

        test("returns true if user exists with email ignore caps", async (done) => {
            request(service.router)
                .get("/user/exists/email/DarioAlessandroLencina@Gmail.com")
                .send()
                .end((err, res) => {
                    expect(res.body.success).toBeTruthy();
                    expect(res.body.result.exists).toEqual(true);
                    expect(res.status).toEqual(200);
                    done();
                });
        }, 1000);

        test("returns false if user with email does not exist", async (done) => {
            request(service.router)
                .get("/user/exists/email/darioalessandrolencina@gail.com")
                .send()
                .end((err, res) => {
                    expect(res.body.success).toBeTruthy();
                    expect(res.body.result.exists).toEqual(false);
                    expect(res.status).toEqual(201);
                    done();
                });
        }, 1000);

        test("returns false if phone number is sent", async (done) => {
            const phoneNumber = "+18888888888";
            await withDB(service.pgClient).then((db) =>
                register(
                    {
                        username: "abhgf",
                        firstName: "abhgf",
                        lastName: "abhgf",
                        picture: undefined,
                        publicKey: "pktest",
                        language: "en",
                    },
                    db,
                ),
            );
            request(service.router)
                .get(`/user/exists/${phoneNumber}`)
                .send()
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            engineeringError: "email with value '+18888888888' is invalid",
                            message: "email with value '+18888888888' is invalid",
                        },
                        success: false,
                    });
                    expect(res.body.success).toBeFalsy();
                    expect(res.status).toEqual(400);
                    done();
                });
        }, 1000);
    });

    describe("userExistsWithPhone", () => {
        let service: AuthServer;

        beforeAll(async () => {
            await dbmate_rebuild();
            service = new AuthServer(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                JWT_CUSTOMER_ALGORITHM,
                pgConfig,
                storageOptions,
            );
            await service.start();
            const phoneNumber = "+18888888888";
            await withDB(service.pgClient).then((db) =>
                register(
                    {
                        username: "abhgf",
                        firstName: "abhgf",
                        lastName: "abhgf",
                        picture: undefined,
                        publicKey: "pktest",
                        language: "en",
                    },
                    db,
                ),
            );
        });

        afterAll((done) => {
            service.stop();
            done();
        });

        test("returns true if user exists with phone number url encoded", async (done) => {
            request(service.router)
                .get("/user/exists/phone/%2B18888888888")
                .send()
                .end((err, res) => {
                    expect(res.body.success).toBeTruthy();
                    expect(res.body.result.exists).toEqual(true);
                    expect(res.status).toEqual(200);
                    done();
                });
        }, 1000);

        test("returns true if user exists with phone number and international country code", async (done) => {
            const phoneNumber = "+50681999999";
            await withDB(service.pgClient).then((db) =>
                register(
                    {
                        username: "abhgfasdf",
                        firstName: "abhgf",
                        lastName: "abhgf",
                        picture: undefined,
                        publicKey: "pktest",
                        language: "en",
                    },
                    db,
                ),
            );

            request(service.router)
                .get(`/user/exists/phone/${phoneNumber}`)
                .send()
                .end((err, res) => {
                    expect(res.body.success).toBeTruthy();
                    expect(res.body.result.exists).toEqual(true);
                    expect(res.status).toEqual(200);
                    done();
                });
        }, 1000);

        test("returns false if user does not exist with phone number", async (done) => {
            request(service.router)
                .get("/user/exists/phone/+50681999997")
                .send()
                .end((err, res) => {
                    expect(res.body.success).toBeTruthy();
                    expect(res.body.result.exists).toEqual(false);
                    expect(res.status).toEqual(201);
                    done();
                });
        }, 1000);

        test("returns false if an email is sent", async (done) => {
            request(service.router)
                .get("/user/exists/phone/darioalessandrolencina@gmail.com")
                .send()
                .end((err, res) => {
                    expect(res.body.success).toBeFalsy();
                    expect(res.body).toEqual({
                        result: {
                            engineeringError: "Invalid Phone Number",
                            message: "Invalid Phone Number",
                        },
                        success: false,
                    });
                    expect(res.status).toEqual(400);
                    done();
                });
        }, 1000);
    });

    describe("verifyCode", () => {
        let service: AuthServer;
        let rabbit: RabbitClient;

        beforeEach(async () => {
            await dbmate_rebuild();

            service = new AuthServer(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                JWT_CUSTOMER_ALGORITHM,
                pgConfig,
                storageOptions,
            );
            await service.start();

            rabbit = new RabbitClient(
                RABBIT_MQ_URL_WITH_CREDS(),
                [notificationsExchange],
                notificationsServerQueue,
            );
            await rabbit.start();
        });

        afterEach(async () => {
            await service.stop();
            await rabbit.close();
        });

        it("login works with deletePreviousDevice = true", async (done) => {
            let currentMessage: any = undefined;

            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });

            request(service.router)
                .post("/login")
                .send({
                    email: "darioalessandrolencina@gmail.com",
                    publicKey: "pktest",
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Successfully created verification request",
                        },
                        success: true,
                    });
                });

            await waitForCondition({
                errorToThrow(): Error {
                    return new Error(`did not receive verification code ${currentMessage}`);
                },
                timeoutMs: 1000,
                pollPeriodMs: 200,
                callback: () => currentMessage != undefined,
            });

            const { code } = currentMessage[0].dynamicTemplateData;

            request(service.router)
                .post("/user/verify/darioalessandrolencina@gmail.com")
                .send({
                    email: "darioalessandrolencina@gmail.com",
                    publicKey: "pktest",
                    code,
                    deviceId: "123dfsdf",
                    os: "Android",
                    osVersion: "sdfsdf",
                    model: "blasdf",
                    deletePreviousDevice: true,
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            username: "dario",
                            email: "darioalessandrolencina@gmail.com",
                            phoneNumber: undefined,
                            firstName: "Dario",
                            language: "en",
                            lastName: "Lencina-Talarico",
                            picture: "predator.png",
                            settings: {
                                followersNeededToDeclareEmergency: 2,
                            },
                            userState: {
                                followersPerception: [
                                    {
                                        perception: "Normal",
                                        username: "billburr",
                                    },
                                    {
                                        perception: "Normal",
                                        username: "louisck",
                                    },
                                ],
                                selfPerceptionState: "Normal",
                            },
                        },
                        success: true,
                    });
                    done();
                });
        }, 10000);

        it("login works with deletePreviousDevice = true and phone number", async (done) => {
            let currentMessage: any = undefined;

            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });
            const username = "terminator1234";
            const phoneNumber = "+18888888888";
            const firstName = "Super";
            const lastName = "Woman";
            const publicKey = "pktest";
            const language = "en";

            await withDB(service.pgClient).then((db) =>
                register(
                    {
                        username,
                        firstName,
                        lastName,
                        picture: undefined,
                        publicKey,
                        language,
                    },
                    db,
                ),
            );

            request(service.router)
                .post("/login")
                .send({
                    phoneNumber,
                    publicKey,
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Successfully created verification request",
                        },
                        success: true,
                    });
                });

            await waitForCondition({
                errorToThrow(): Error {
                    return new Error(`did not receive verification code ${currentMessage}`);
                },
                timeoutMs: 2000,
                pollPeriodMs: 200,
                callback: () => currentMessage != undefined,
            });

            const body: string = currentMessage[0].body;
            const temp = body.split("\n")[0];
            const code = temp.substr(temp.length - 5);

            request(service.router)
                .post(`/user/verify/${phoneNumber}`)
                .send({
                    phoneNumber,
                    publicKey,
                    code,
                    deviceId: "123dfsdf",
                    os: "Android",
                    osVersion: "sdfsdf",
                    model: "blasdf",
                    deletePreviousDevice: true,
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            username,
                            phoneNumber,
                            firstName,
                            language,
                            lastName,
                            email: undefined,
                            picture: undefined,
                            settings: {
                                followersNeededToDeclareEmergency: 2,
                            },
                            userState: {
                                followersPerception: [],
                                selfPerceptionState: "Normal",
                            },
                        },
                        success: true,
                    });
                    done();
                });
        }, 10000);

        it("register works with phone number", async (done) => {
            let currentMessage: any = undefined;

            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });

            request(service.router)
                .post("/register")
                .send({
                    username: "terminator9999",
                    firstName: "first-test",
                    lastName: "last-test",
                    phoneNumber: "+18888888889",
                    publicKey: "pktest",
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Successfully created verification request",
                        },
                        success: true,
                    });
                });

            await waitForCondition({
                errorToThrow(): Error {
                    return new Error(`did not receive verification code ${currentMessage}`);
                },
                timeoutMs: 2000,
                pollPeriodMs: 200,
                callback: () => currentMessage != undefined,
            });

            const body: string = currentMessage[0].body;
            const temp = body.split("\n")[0];
            const code = temp.substr(temp.length - 5);

            request(service.router)
                .post("/user/verify/+18888888889")
                .send({
                    phoneNumber: "+18888888889",
                    publicKey: "pktest",
                    code,
                    deviceId: "123dfsd4",
                    os: "Android",
                    osVersion: "sdfsdf",
                    model: "blasdf",
                    deletePreviousDevice: true,
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            username: "terminator9999",
                            phoneNumber: "+18888888889",
                            email: undefined,
                            firstName: "first-test",
                            language: "en",
                            lastName: "last-test",
                            picture: undefined,
                            settings: {
                                followersNeededToDeclareEmergency: 2,
                            },
                            userState: {
                                followersPerception: [],
                                selfPerceptionState: "Normal",
                            },
                        },
                        success: true,
                    });
                    done();
                });
        }, 10000);

        it("register does not work with invalid phone number", async (done) => {
            request(service.router)
                .post("/register")
                .send({
                    username: "terminator9999",
                    firstName: "first-test",
                    lastName: "last-test",
                    phoneNumber: "+188888888",
                    publicKey: "pktest",
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Invalid Phone Number",
                            engineeringError: "Invalid Phone Number",
                        },
                        success: false,
                    });
                    expect(res.status).toEqual(400);
                    done();
                });
        }, 10000);

        it("register does not work with invalid email", async (done) => {
            request(service.router)
                .post("/register")
                .send({
                    username: "terminator9999",
                    firstName: "first-test",
                    lastName: "last-test",
                    email: "abc@$@!@#asd@acas.net",
                    publicKey: "pktest",
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Email is not in a valid format",
                            engineeringError: "Email is not in a valid format",
                        },
                        success: false,
                    });
                    expect(res.status).toEqual(400);
                    done();
                });
        }, 10000);

        it("works with email in caps", async (done) => {
            let currentMessage: any = undefined;

            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });

            request(service.router)
                .post("/login")
                .send({
                    email: "DarioAlessandroLencina@gmail.com",
                    publicKey: "pktest",
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Successfully created verification request",
                        },
                        success: true,
                    });
                });

            await waitForCondition({
                errorToThrow(): Error {
                    return new Error(`did not receive verification code ${currentMessage}`);
                },
                timeoutMs: 2000,
                pollPeriodMs: 200,
                callback: () => currentMessage != undefined,
            });

            const { code } = currentMessage[0].dynamicTemplateData;

            request(service.router)
                .post("/user/verify/DarioAlessandroLencina@gmail.com")
                .send({
                    publicKey: "pktest",
                    code,
                    deviceId: "123dfsdf",
                    os: "Android",
                    osVersion: "sdfsdf",
                    model: "blasdf",
                    deletePreviousDevice: true,
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            username: "dario",
                            email: "darioalessandrolencina@gmail.com",
                            firstName: "Dario",
                            phoneNumber: undefined,
                            language: "en",
                            lastName: "Lencina-Talarico",
                            picture: "predator.png",
                            settings: {
                                followersNeededToDeclareEmergency: 2,
                            },
                            userState: {
                                followersPerception: [
                                    {
                                        perception: "Normal",
                                        username: "billburr",
                                    },
                                    {
                                        perception: "Normal",
                                        username: "louisck",
                                    },
                                ],
                                selfPerceptionState: "Normal",
                            },
                        },
                        success: true,
                    });
                    done();
                });
        }, 10000);

        it("login works with deletePreviousDevice = true even when there are no other devices", async (done) => {
            let currentMessage: any = undefined;
            await withDB(service.pgClient).then((db) =>
                deleteDevice({ username: "dario", deviceId: "dario_iphone" }, db),
            );

            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });

            request(service.router)
                .post("/login")
                .send({
                    email: "darioalessandrolencina@gmail.com",
                    publicKey: "pktest",
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Successfully created verification request",
                        },
                        success: true,
                    });
                });

            await waitForCondition({
                errorToThrow(): Error {
                    return new Error(`did not receive verification code ${currentMessage}`);
                },
                timeoutMs: 1000,
                pollPeriodMs: 200,
                callback: () => currentMessage != undefined,
            });

            const { code } = currentMessage[0].dynamicTemplateData;

            request(service.router)
                .post("/user/verify/darioalessandrolencina@gmail.com")
                .send({
                    email: "darioalessandrolencina@gmail.com",
                    publicKey: "pktest",
                    code,
                    deviceId: "123dfsdf",
                    os: "Android",
                    osVersion: "sdfsdf",
                    model: "blasdf",
                    deletePreviousDevice: true,
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            username: "dario",
                            email: "darioalessandrolencina@gmail.com",
                            phoneNumber: undefined,
                            firstName: "Dario",
                            language: "en",
                            lastName: "Lencina-Talarico",
                            picture: "predator.png",
                            settings: {
                                followersNeededToDeclareEmergency: 2,
                            },
                            userState: {
                                followersPerception: [
                                    {
                                        perception: "Normal",
                                        username: "billburr",
                                    },
                                    {
                                        perception: "Normal",
                                        username: "louisck",
                                    },
                                ],
                                selfPerceptionState: "Normal",
                            },
                        },
                        success: true,
                    });
                    done();
                });
        }, 10000);

        it("login works with deletePreviousDevice = true and forces to disassociate device with older account", async (done) => {
            let currentMessage: any = undefined;

            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });

            request(service.router)
                .post("/login")
                .send({
                    email: "darioalessandrolencina@gmail.com",
                    publicKey: "pktest",
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Successfully created verification request",
                        },
                        success: true,
                    });
                });

            await waitForCondition({
                errorToThrow(): Error {
                    return new Error(`did not receive verification code ${currentMessage}`);
                },
                timeoutMs: 1000,
                pollPeriodMs: 200,
                callback: () => currentMessage != undefined,
            });

            const { code } = currentMessage[0].dynamicTemplateData;

            request(service.router)
                .post("/user/verify/darioalessandrolencina@gmail.com")
                .send({
                    email: "darioalessandrolencina@gmail.com",
                    publicKey: "pktest",
                    code,
                    deviceId: "coche_iphone",
                    os: "Android",
                    osVersion: "sdfsdf",
                    model: "blasdf",
                    deletePreviousDevice: true,
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            username: "dario",
                            email: "darioalessandrolencina@gmail.com",
                            phoneNumber: undefined,
                            firstName: "Dario",
                            language: "en",
                            lastName: "Lencina-Talarico",
                            picture: "predator.png",
                            settings: {
                                followersNeededToDeclareEmergency: 2,
                            },
                            userState: {
                                followersPerception: [
                                    {
                                        perception: "Normal",
                                        username: "billburr",
                                    },
                                    {
                                        perception: "Normal",
                                        username: "louisck",
                                    },
                                ],
                                selfPerceptionState: "Normal",
                            },
                        },
                        success: true,
                    });
                    done();
                });
        }, 10000);

        it("login works with 3 different codes requested in a sequence, all codes work", async (done) => {
            const codes: string[] = [];
            const numberOfCodesToSend = 3;

            await withDB(service.pgClient).then((db) =>
                deleteDevice({ username: "dario", deviceId: "dario_iphone" }, db),
            );

            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                rabbit.channel?.ack(msg);
                const message = JSON.parse(msg.content.toString());
                const {
                    dynamicTemplateData: { code },
                } = message[0];
                codes.push(code);
            });

            for (let n = 0; n < numberOfCodesToSend; n++) {
                request(service.router)
                    .post("/login")
                    .send({
                        email: "darioalessandrolencina@gmail.com",
                        publicKey: `pktest{n}`,
                    })
                    .end((err, res) => {
                        expect(res.body).toEqual({
                            result: {
                                message: "Successfully created verification request",
                            },
                            success: true,
                        });
                    });
            }

            await waitForCondition({
                errorToThrow(): Error {
                    return new Error(`did not receive verification codes ${JSON.stringify(codes)}`);
                },
                timeoutMs: 3000,
                pollPeriodMs: 200,
                callback: () => codes.length === numberOfCodesToSend,
            });

            const sendRequest = (codes: string[]) => {
                request(service.router)
                    .post("/user/verify/darioalessandrolencina@gmail.com")
                    .send({
                        email: "darioalessandrolencina@gmail.com",
                        publicKey: "pktest",
                        code: codes.pop(),
                        deviceId: "123dfsdf",
                        os: "Android",
                        osVersion: "sdfsdf",
                        model: "blasdf",
                        deletePreviousDevice: true,
                    })
                    .end((err, res) => {
                        expect(res.body).toEqual({
                            result: {
                                username: "dario",
                                email: "darioalessandrolencina@gmail.com",
                                phoneNumber: undefined,
                                firstName: "Dario",
                                language: "en",
                                lastName: "Lencina-Talarico",
                                picture: "predator.png",
                                settings: {
                                    followersNeededToDeclareEmergency: 2,
                                },
                                userState: {
                                    followersPerception: [
                                        {
                                            perception: "Normal",
                                            username: "billburr",
                                        },
                                        {
                                            perception: "Normal",
                                            username: "louisck",
                                        },
                                    ],
                                    selfPerceptionState: "Normal",
                                },
                            },
                            success: true,
                        });
                        if (codes.length == 0) {
                            done();
                        } else {
                            sendRequest(codes);
                        }
                    });
            };
            sendRequest(codes);
        }, 10000);

        it("login does not work with invalid code", async (done) => {
            let currentMessage: any = undefined;

            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });
            await withDB(service.pgClient).then((db) =>
                deleteDevice({ username: "dario", deviceId: "dario_iphone" }, db),
            );
            request(service.router)
                .post("/login")
                .send({
                    email: "darioalessandrolencina@gmail.com",
                    publicKey: "pktest",
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Successfully created verification request",
                        },
                        success: true,
                    });
                });

            await waitForCondition({
                errorToThrow(): Error {
                    return new Error(`did not receive verification code ${currentMessage}`);
                },
                timeoutMs: 1000,
                pollPeriodMs: 200,
                callback: () => currentMessage != undefined,
            });

            const code = "yolo";

            request(service.router)
                .post("/user/verify/darioalessandrolencina@gmail.com")
                .send({
                    email: "darioalessandrolencina@gmail.com",
                    publicKey: "pktest",
                    code,
                    deviceId: "123dfsdf",
                    os: "Android",
                    osVersion: "sdfsdf",
                    model: "blasdf",
                    deletePreviousDevice: true,
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            engineeringError: "verification failure",
                            message:
                                "Unable to verify ownership of this account, please, send another code or try to login again.",
                        },
                        success: false,
                    });
                    done();
                });
        }, 5000);

        it("login does not work with deletePreviousDevice = false", async (done) => {
            let currentMessage: any = undefined;

            rabbit.consumeFromQueue(async (msg: amqp.Message) => {
                rabbit.channel?.ack(msg);
                currentMessage = JSON.parse(msg.content.toString());
            });

            request(service.router)
                .post("/login")
                .send({
                    email: "darioalessandrolencina@gmail.com",
                    publicKey: "pktest",
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            message: "Successfully created verification request",
                        },
                        success: true,
                    });
                });

            await waitForCondition({
                errorToThrow(): Error {
                    return new Error(`did not receive verification code ${currentMessage}`);
                },
                timeoutMs: 1000,
                pollPeriodMs: 200,
                callback: () => currentMessage != undefined,
            });

            const { code } = currentMessage[0].dynamicTemplateData;

            currentMessage = undefined;

            request(service.router)
                .post("/user/verify/darioalessandrolencina@gmail.com")
                .send({
                    email: "darioalessandrolencina@gmail.com",
                    publicKey: "pktest",
                    code,
                    deviceId: "123dfsdf",
                    os: "Android",
                    osVersion: "sdfsdf",
                    model: "blasdf",
                    deletePreviousDevice: false,
                })
                .end((err, res) => {
                    expect(res.body).toEqual({
                        result: {
                            engineeringError:
                                "Unable to register device because the user has another device registered",
                            message:
                                "There is another device registered in your profile, please unregister that device first before attempting to login, you can also force to unregister that device.",
                        },
                        success: false,
                    });

                    request(service.router)
                        .post("/user/verify/darioalessandrolencina@gmail.com")
                        .send({
                            email: "darioalessandrolencina@gmail.com",
                            publicKey: "pktest",
                            code,
                            deviceId: "123dfsdf",
                            os: "Android",
                            osVersion: "sdfsdf",
                            model: "blasdf",
                            deletePreviousDevice: true,
                        })
                        .end((err, res) => {
                            expect(res.body).toEqual({
                                result: {
                                    username: "dario",
                                    email: "darioalessandrolencina@gmail.com",
                                    phoneNumber: undefined,
                                    firstName: "Dario",
                                    language: "en",
                                    lastName: "Lencina-Talarico",
                                    picture: "predator.png",
                                    settings: {
                                        followersNeededToDeclareEmergency: 2,
                                    },
                                    userState: {
                                        followersPerception: [
                                            {
                                                perception: "Normal",
                                                username: "billburr",
                                            },
                                            {
                                                perception: "Normal",
                                                username: "louisck",
                                            },
                                        ],
                                        selfPerceptionState: "Normal",
                                    },
                                },
                                success: true,
                            });
                            done();
                        });
                });
        }, 5000);
    });

    describe("delete user", () => {
        let service: AuthServer;

        beforeEach(async () => {
            await dbmate_rebuild();

            service = new AuthServer(
                await getPort(),
                RABBIT_MQ_URL_WITH_CREDS(),
                JWT_CUSTOMER_ALGORITHM,
                pgConfig,
                storageOptions,
            );
            await service.start();
        });

        afterEach(async () => {
            await service.stop();
        });

        it("delete user", async () => {
            expect(
                (
                    await service.pgClient.connection!.query(
                        "SELECT * from users where username = 'dario'",
                    )
                ).rowCount,
            ).toEqual(1);
            expect(
                (
                    await service.pgClient.connection!.query(
                        "DELETE from users where username = 'dario'",
                    )
                ).rowCount,
            ).toEqual(1);
            expect(
                (
                    await service.pgClient.connection!.query(
                        "SELECT * from users where username = 'dario'",
                    )
                ).rowCount,
            ).toEqual(0);
            expect(
                (
                    await service.pgClient.connection!.query(
                        "SELECT * from user_details where username = 'dario'",
                    )
                ).rowCount,
            ).toEqual(0);
            expect(
                (
                    await service.pgClient.connection!.query(
                        "SELECT * from users_devices where username = 'dario'",
                    )
                ).rowCount,
            ).toEqual(0);
            expect(
                (
                    await service.pgClient.connection!.query(
                        "SELECT * from users_followers where username = 'dario'",
                    )
                ).rowCount,
            ).toEqual(0);
            expect(
                (
                    await service.pgClient.connection!.query(
                        "SELECT * from users_followers_state where username = 'dario'",
                    )
                ).rowCount,
            ).toEqual(0);
            expect(
                (
                    await service.pgClient.connection!.query(
                        "SELECT * from users_settings where username = 'dario'",
                    )
                ).rowCount,
            ).toEqual(0);
            expect(
                (
                    await service.pgClient.connection!.query(
                        "SELECT * from users_state where username = 'dario'",
                    )
                ).rowCount,
            ).toEqual(0);
            expect(
                (
                    await service.pgClient.connection!.query(
                        "SELECT * from device_telemetry where username = 'dario'",
                    )
                ).rowCount,
            ).toEqual(0);
        });
    });
});
