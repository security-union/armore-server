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

import express from "express";
import bodyParser from "body-parser";
import errorHandler from "errorhandler";
import * as core from "express-serve-static-core";
import { JWT_HEADER_TOKEN } from "./constants";

const router = (): core.Express => {
    const router = express();
    router.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET,PUT,PATCH,POST,DELETE");
        res.header(
            "Access-Control-Allow-Headers",
            `Origin, X-Requested-With, Content-Type, Accept, ${JWT_HEADER_TOKEN}`,
        );
        next();
    });

    router.use(bodyParser.json({ limit: "5mb" }));
    router.use(bodyParser.urlencoded({ extended: true }));
    router.use(
        bodyParser.raw({
            type: "application/octet-stream",
            limit: "5mb",
        }),
    );
    // TODO (Dario): Error Handler. Provides full stack - remove for production
    router.use(errorHandler());
    return router;
};

export default router;
