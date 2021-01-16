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

import WebSocket from "ws";
import express from "express";
import { IncomingMessage } from "http";
import { Server } from "http";
import * as core from "express-serve-static-core";
import amqp from "amqplib";

import { decodeJwtTokenWebSocket } from "../common/authentication";
import { JWT_CUSTOMER_ALGORITHM, WS_GATEWAY_PORT } from "../common/constants";

import { Service } from "../common/service";
import { logger } from "../common/logger";
import { ClientConfig } from "pg";
import { Device } from "../common/types";
import { DBClient } from "../common/db/db";
import { RedisConfig } from "../common/tedis-config";
import { RabbitClient, QueueOptions } from "../common/rabbit-helpers";
import { websocketExchange } from "../common/rabbit-constants";

export interface LocationUpdate {
    location: Location;
    timestamp: number;
    username: string;
    deviceId: string;
}

class WebSocketRef {
    ws: WebSocket;
    isAlive: boolean;

    constructor(ws: WebSocket) {
        this.ws = ws;
        this.isAlive = true;
    }
}

export const websocketQueueName = ({ username, deviceId }: Device) =>
    `location.${username}.${deviceId}`;

export const websocketRoutingKey = ({ username }: Device) => `location.${username}.*`;

/**
 * Service used by RaspberryPI Devices to connect the backend to receive commands.
 */
export class WSGateway implements Service {
    readonly rabbit: RabbitClient;
    readonly wss: WebSocket.Server;

    /**
     * key should be username_deviceId: Websocket.
     */
    readonly socketConnections: Map<string, WebSocketRef> = new Map();

    /**
     * Friends graph, username to username_deviceId array
     */
    readonly friendsGraph: Map<string, Array<string>> = new Map();
    readonly httpServer: Server;
    readonly router: core.Express;
    interval: number | NodeJS.Timer | undefined;

    pgClient: DBClient;

    constructor(
        httpPort: number,
        rabbitMQUrl: string,
        pgConfig: ClientConfig,
        redisConfig: RedisConfig,
    ) {
        // 1. Setup RPC Client using RabbitMQ.
        this.rabbit = new RabbitClient(rabbitMQUrl, [websocketExchange], undefined);

        // 2. Setup websocket server.
        this.router = express();
        this.httpServer = this.router.listen(httpPort, () => {
            logger.info(`Started WSGateway listening on port ${httpPort}`);
        });
        this.wss = new WebSocket.Server({
            server: this.httpServer,
        });

        // 3. Configure DB Client.
        this.pgClient = new DBClient(pgConfig);
    }

    start = async (): Promise<void> => {
        await this.rabbit.start();
        this.wss.on("listening", () => logger.info(`WS Server listening on ${WS_GATEWAY_PORT}`));
        this.wss.on("connection", this.onWSConnection);
        this.startPingInteval();
        await this.pgClient.connect();
    };

    stop = async () => {
        await this.rabbit.close();
        this.httpServer.close();
    };

    // WS Server Callbacks start ************
    onWSConnection = async (connection: WebSocket, req: IncomingMessage) => {
        let parsedData = { deviceId: "", username: "" };

        const { decodeError, decoded } = await decodeJwtTokenWebSocket(
            req,
            JWT_CUSTOMER_ALGORITHM,
            this.pgClient,
        );
        logger.info("got connection");
        if (decodeError === null || decodeError === undefined) {
            if (typeof decoded === "object") {
                parsedData = decoded;
                logger.info("decoded data");
            } else {
                logger.error("did not find token, bye bye 1");
                connection.close();
                return;
            }
        } else {
            logger.error(`token decode error ${decodeError}`);
            connection.close();
            return;
        }

        const { channel } = this.rabbit;
        if (channel == undefined) {
            connection.close();
            logger.error("RabbitMQ is down");
            return;
        }

        const websocketName = websocketQueueName(parsedData);
        const subscriptionWithWildcard = websocketRoutingKey(parsedData);

        const oldConnection = this.socketConnections.get(websocketName);
        if (oldConnection) {
            oldConnection.ws.removeAllListeners();
            oldConnection.ws.close();
            this.socketConnections.delete(websocketName);
            try {
                await channel.deleteQueue(websocketName);
            } catch (e) {}
            logger.info(`on close ${websocketName}`);
        }

        this.socketConnections.set(websocketName, new WebSocketRef(connection));

        connection.on("pong", (ws: WebSocket) => {
            const _connection = this.socketConnections.get(websocketName);
            if (_connection) {
                _connection.isAlive = true;
                logger.info(`got pong from ${websocketName}`);
            }
        });

        connection.on("message", (data: WebSocket.Data) => {
            // WebSocket is read only.
        });

        connection.on("close", async () => {
            logger.info(`on close ${websocketName}`);
            if (this.socketConnections.has(websocketName)) {
                this.socketConnections.delete(websocketName);
                try {
                    await channel.unbindQueue(
                        websocketName,
                        websocketExchange.name,
                        websocketExchange.pattern,
                    );
                    await channel.deleteQueue(websocketName);
                } catch (e) {
                    logger.error(e);
                }
            }
        });

        try {
            logger.info(`creating queue for ${websocketName}`);
            await channel.assertQueue(websocketName, {
                exclusive: true,
                durable: false,
            });
            await channel.assertExchange(websocketExchange.name, websocketExchange.type, {
                durable: false,
            });
            logger.info(`binding queue for ${websocketName}`);
            await channel.bindQueue(
                websocketName,
                websocketExchange.name,
                subscriptionWithWildcard,
            );

            await channel.consume(websocketName, async (msg: amqp.Message) => {
                if (msg) {
                    const _connection = this.socketConnections.get(websocketName);
                    logger.debug(`sending sw update to ${websocketName} ${msg.content.toString()}`);
                    if (_connection) {
                        _connection.ws.send(msg.content.toString());
                    }
                    channel.ack(msg);
                }
            });
        } catch (e) {
            logger.error(e);
            connection.close();
        }
    };

    // WS Server Callbacks end **************
    startPingInteval = () => {
        logger.debug("scheduled pings");
        this.interval = setInterval(() => {
            this.socketConnections.forEach((ws: WebSocketRef, key: String) => {
                logger.debug(`sending ping to ${key}`);
                if (!ws.isAlive) {
                    ws.ws.terminate();
                }
                ws.isAlive = false;
                ws.ws.ping(() => {});
            });
        }, 20000);
    };
}
