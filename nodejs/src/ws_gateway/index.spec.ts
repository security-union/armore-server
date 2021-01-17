// /**
//  * Copyright [2018] [Dario Alessandro Lencina Talarico]
//  * Licensed under the Apache License, Version 2.0 (the "License");
//  * y ou may not use this file except in compliance with the License.
//  * You may obtain a copy of the License at
//  * http://www.apache.org/licenses/LICENSE-2.0
//  * Unless required by applicable law or agreed to in writing, software
//  * distributed under the License is distributed on an "AS IS" BASIS,
//  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  * See the License for the specific language governing permissions and
//  * limitations under the License.
//  */

// import sinon from "sinon";
// import { ClientConfig } from "pg";
// import getPort from "get-port";

// import { Phone } from "./phone";
// import { WSGateway } from "./index";
// import {
//     PG_USER,
//     PG_DB,
//     PG_PASS,
//     PG_PORT,
//     PG_HOST,
//     RABBIT_MQ_URL_WITH_CREDS,
// } from "../common/constants";
// import {
//     generateJwtTokenHelper,
//     MOCK_PRIVATE_KEY,
//     MOCK_PUBLIC_KEY,
// } from "../common/authentication";
// import { ensureThatConditionHoldsForPeriod, waitForCondition } from "../common/test_utils";
// import { registerPublicKey2 } from "../common/db/authentication";

describe.skip("ws_gateway", () => {
    it.skip("skip websocket tests", () => {});
});

// describe("ws_gateway", () => {
//     let service: WSGateway;
//     let port: number;
//     let pgConfig: ClientConfig;
//     const jwtToken = generateJwtTokenHelper(MOCK_PRIVATE_KEY, {
//         username: "dario",
//         deviceId: "dario_iphone",
//     });

//     beforeEach(async () => {
//         pgConfig = {
//             user: PG_USER,
//             database: PG_DB,
//             password: PG_PASS,
//             port: PG_PORT,
//             host: PG_HOST,
//             keepAlive: true,
//             // statement_timeout?: false | number;
//         };
//         port = await getPort();
//     });

//     afterEach(async () => {
//         await service.stop();
//     });

//     describe("authorization", () => {
//         test("allows authorized phones to connect", async () => {
//             service = new WSGateway(port, RABBIT_MQ_URL_WITH_CREDS(), pgConfig, {});
//             await service.start();
//             const deviceInfo = { deviceId: "324", username: "dario" };
//             const phone = new Phone({
//                 timeout: 10000,
//                 serverUrl: `ws://localhost:${port}`,
//                 jwtToken,
//                 onMsg: () => {},
//             });
//             await phone.connect();
//             expect(service.socketConnections.size).toEqual(1);
//             const connection = service.socketConnections.get(deviceInfo.deviceId);
//             expect(connection).toBeTruthy();
//             await phone.disconnect();
//         });

//         test("rejects unauthorized phones", async () => {
//             service = new WSGateway(port, RABBIT_MQ_URL_WITH_CREDS(), pgConfig, {});
//             await service.start();
//             const deviceInfo = { deviceId: "324", username: "dario" };
//             const phone = new Phone({
//                 timeout: 10000,
//                 serverUrl: `ws://localhost:${port}`,
//                 jwtToken,
//                 onMsg: () => {},
//             });
//             await phone.connect();
//             expect(service.socketConnections.size).toEqual(0);
//             const connection = service.socketConnections.get(deviceInfo.deviceId);
//             expect(connection).toBeFalsy();
//         });
//     });

//     describe("location updates", () => {
//         const cocheJwtToken = generateJwtTokenHelper(MOCK_PRIVATE_KEY, {
//             username: "coche",
//             deviceId: "coche",
//         });

//         const darioJwtToken = generateJwtTokenHelper(MOCK_PRIVATE_KEY, {
//             username: "dario",
//             deviceId: "dario",
//         });

//         test("allows coche to send location updates to dario", async () => {
//             service = new WSGateway(port, RABBIT_MQ_URL_WITH_CREDS(), pgConfig, {});

//             await service.start();
//             await registerPublicKey2(
//                 { username: "dario", publicKey: MOCK_PUBLIC_KEY },
//                 service.pgClient,
//             );
//             await registerPublicKey2(
//                 { username: "coche", publicKey: MOCK_PUBLIC_KEY },
//                 service.pgClient,
//             );

//             const phoneCoche = new Phone({
//                 timeout: 10000,
//                 serverUrl: `ws://localhost:${port}`,
//                 jwtToken: cocheJwtToken,
//                 onMsg: () => {},
//             });
//             const phoneDario = new Phone({
//                 timeout: 10000,
//                 serverUrl: `ws://localhost:${port}`,
//                 jwtToken: darioJwtToken,
//                 onMsg: () => {},
//             });

//             // Establish that dario has shared his location with joseluis.

//             await phoneCoche.connect();
//             await phoneDario.connect();

//             // phone a pushes a location update.
//             phoneCoche.ws.send(
//                 JSON.stringify({
//                     topic: `/telemetry/phonea`,
//                     payload: {
//                         location: {
//                             lat: 34.234,
//                             lon: 84.98,
//                         },
//                     },
//                 }),
//             );

//             await waitForCondition({
//                 timeoutMs: 3000,
//                 pollPeriodMs: 100,
//                 callback: () => {
//                     return phoneDario.receivedMessages.length === 1;
//                 },
//                 errorToThrow: () => new Error("did not receive telemetry thing"),
//             });
//         });

//         test("coche does not receive location updates from dario's phone a because it is not a friend", async () => {
//             service = new WSGateway(port, "", pgConfig, {});
//             await service.start();
//             await registerPublicKey2(
//                 { username: "dario", publicKey: MOCK_PUBLIC_KEY },
//                 service.pgClient,
//             );
//             await registerPublicKey2(
//                 { username: "coche", publicKey: MOCK_PUBLIC_KEY },
//                 service.pgClient,
//             );
//             const phoneCoche = new Phone({
//                 timeout: 10000,
//                 serverUrl: `ws://localhost:${port}`,
//                 jwtToken: cocheJwtToken,
//                 onMsg: () => {},
//             });
//             const phoneDario = new Phone({
//                 timeout: 10000,
//                 serverUrl: `ws://localhost:${port}`,
//                 jwtToken: darioJwtToken,
//                 onMsg: () => {},
//             });

//             // Establish that dario has shared his location with joseluis.

//             await phoneCoche.connect();
//             await phoneDario.connect();

//             // phone a pushes a location update.
//             phoneCoche.ws.send(
//                 JSON.stringify({
//                     topic: `/telemetry/phonea`,
//                     payload: {
//                         location: {
//                             lat: 34.234,
//                             lon: 84.98,
//                         },
//                     },
//                 }),
//             );

//             await ensureThatConditionHoldsForPeriod({
//                 timeoutMs: 3000,
//                 pollPeriodMs: 100,
//                 callback: () => {
//                     return phoneDario.receivedMessages.length === 0;
//                 },
//             });
//         });
//     });
// });
