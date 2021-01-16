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
import { logger } from "./logger";
import { sleep } from "./sleep";

const RETRY_TIMEOUT_MS = 1000;

/**
 * Amqp client that retries to connect until it is successful.
 */
export const connect = async (url: string, socketOptions?: any): Promise<amqp.Connection> => {
    try {
        return await amqp.connect(url, socketOptions);
    } catch (e) {
        logger.error(e);
        await sleep(RETRY_TIMEOUT_MS);
        return connect(url, socketOptions);
    }
};
