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

        test.skip("create geofences for people you follow", async (done) => {
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

        test.skip("cannot create geofences for people you do not follow", async (done) => {
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

});
