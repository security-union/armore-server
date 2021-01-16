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

import { Client, ClientConfig } from "pg";

import { logger } from "../logger";
import { sleep } from "../sleep";
import { DBClientWithConnection } from "../types";

export class DBClient {
    connection: Client | undefined;
    readonly pgConfig: ClientConfig;

    constructor(pgConfig: ClientConfig) {
        this.pgConfig = pgConfig;
    }

    connect = async () => {
        try {
            this.connection = new Client(this.pgConfig);
            await this.connection.connect();
        } catch (e) {
            logger.error(e);
            await sleep(500);
            await this.connect();
        }
    };

    end = async () => {
        if (this.connection) {
            await this.connection.end();
        }
    };
}

export const withDB = async (c: DBClient): Promise<DBClientWithConnection> => {
    if (!c.connection) {
        throw new Error("DB Connection is dead");
    }
    return { connection: c.connection };
};

/**
 * Convenience util to open a serializable transaction.
 *
 * @param c
 * @param body
 */
export const withSerializableTransaction = async (
    c: DBClient,
    body: (cc: DBClientWithConnection) => Promise<any>,
): Promise<any> =>
    withDB(c).then(async (cc: DBClientWithConnection) => {
        try {
            await cc.connection.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
            const result = await body(cc);
            await cc.connection.query("COMMIT TRANSACTION");
            return result;
        } catch (e) {
            logger.error(e);
            await cc.connection.query("ROLLBACK");
            throw e;
        }
    });
