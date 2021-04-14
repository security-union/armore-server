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
import { param, validationResult } from "express-validator";

import { Service } from "../common/service";
import { logger } from "../common/logger";
import router from "../common/router";
import { auth } from "../common/authentication";
import { DBClient, withSerializableTransaction } from "../common/db/db";
import { RedisConfig } from "../common/tedis-config";
import { StorageOptions, StorageClient } from "../common/storage";
import {
    createGeofence,
    getGeofences,
    subscribeToGeofence,
    unsubscribeFromGeofence,
    deleteGeofence,
} from "../common/db/geofences";
import { createError } from "../common/sanitizer";
import { QueueOptions, RabbitClient } from "../common/rabbit-helpers";
import { notificationsExchange } from "../common/rabbit-constants";
import { withErrorBoundary } from "../common/localization/error-boundary";
import { translate } from "../common/localization/localization";
import { Trans } from "../common/localization/translation";
import { changeAccessType } from "../common/db/social";

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
        this.router.post(
            "/me/connections/followers/:username/accessType/:accessType",
            [
                param("username").isLength({ min: 3, max: 255 }).trim().isString(),
                param("accessType").isLength({ min: 3, max: 255 }).trim().isString(),
            ],
            this.changeAccessType,
        );
        this.router.get("/image/:image", this.getImage);
        this.router.get("/geofences", this.getGeofences);
        this.router.post("/geofences", this.createGeofence);
        this.router.post("/geofences/subscribe/:geofenceId", this.subscribeGeofence);
        this.router.post("/geofences/unsubscribe/:geofenceId", this.unsubscribeGeofence);
        this.router.delete("/geofences/:geofenceId", this.deleteGeofence);
    };

    stop = async () => {
        this.httpServer.close();
        await this.rabbit.close();
        await this.pgClient.end();
    };
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

    getImage = async (req: Request, res: Response) =>
        auth(req, res, this.pgClient, async ({ username }) =>
            withErrorBoundary(req, res, async () => {
                const image = req.params.image;
                const data = await this.storage.readImage(image);
                res.status(200).send(data);
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
}
