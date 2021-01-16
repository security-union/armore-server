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

import jwt, { TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";
import { Request, Response } from "express";
import { IncomingMessage } from "http";

import { JWT_CUSTOMER_ALGORITHM, JWT_HEADER_TOKEN } from "./constants";
import { DBClient } from "./db/db";
import { logger } from "./logger";
import { translate, translateWithFormat } from "./localization/localization";
import { Trans } from "./localization/translation";

interface JwtTokenPayload {
    username: string;
    exp: string;
    iat: string;
}

const authHelper = async (
    algorithm: string,
    req: Request,
    res: Response,
    next: (decodedObject: any) => void,
    pgClient: DBClient,
) => {
    try {
        const { decodeError, decoded } = await decodeJwtToken(req, algorithm, pgClient);
        if (decodeError === null || decodeError === undefined) {
            if (typeof decoded === "object") {
                next(decoded);
            } else {
                res.status(500).send({
                    success: false,
                    result: { message: "internal server error in jwt decode" },
                });
            }
        } else {
            res.status(403).send({ success: false, result: { message: decodeError.message } });
        }
    } catch (e) {
        logger.error(e);
        const error = translate(Trans.InternalServerError, req);
        res.status(500).send({
            success: false,
            result: { message: error, engineeringError: "Internal error during auth" },
        });
    }
};

export const decodeJwtToken = async (
    req: Request,
    algorithm: string,
    pgClient: DBClient,
): Promise<{
    decoded: JwtTokenPayload | undefined;
    decodeError: JsonWebTokenError | undefined;
}> => {
    // Express headers are auto converted to lowercase.
    const token: string | string[] | undefined = req.headers[JWT_HEADER_TOKEN];

    if (typeof token === "string") {
        const claims = jwt.decode(token, {});
        if (typeof claims !== "object") {
            return {
                decodeError: new TokenExpiredError("no object claims", new Date()),
                decoded: undefined,
            };
        }

        if (claims) {
            const username = claims["username"];
            // @ts-ignore
            const publicKeyResult = await pgClient.connection.query(
                `
                SELECT public_key
                from users_identity
                where username = $1
            `,
                [username],
            );
            if (publicKeyResult.rowCount < 1) {
                return {
                    decodeError: new TokenExpiredError("no pk", new Date()),
                    decoded: undefined,
                };
            }

            const rawPublicKey = publicKeyResult.rows[0].public_key.replace(/\\n/gm, "\n");
            const publicKey =
                "-----BEGIN PUBLIC KEY-----\n" +
                `${rawPublicKey.endsWith("\n") ? rawPublicKey : `${rawPublicKey}\n`}` +
                "-----END PUBLIC KEY-----\n`";

            let decodeError = undefined;
            let decoded = undefined;
            jwt.verify(
                token,
                publicKey,
                {
                    algorithms: [algorithm],
                },
                (err, _decoded) => {
                    decodeError = err;
                    decoded = _decoded;
                },
            );
            return { decodeError, decoded };
        } else {
            return {
                decodeError: new TokenExpiredError("no claims yo", new Date()),
                decoded: undefined,
            };
        }
    } else {
        return { decodeError: new TokenExpiredError("no token", new Date()), decoded: undefined };
    }
};

export const decodeJwtTokenWebSocket = async (
    req: IncomingMessage,
    algorithm: string,
    pgClient: DBClient,
): Promise<{
    decoded: { username: string; deviceId: string } | undefined;
    decodeError: JsonWebTokenError | undefined;
}> => {
    // Express headers are auto converted to lowercase.
    const token: string | string[] | undefined = req.headers[JWT_HEADER_TOKEN];
    if (typeof token === "string") {
        const claims = jwt.decode(token, {});
        if (typeof claims !== "object") {
            return {
                decodeError: new TokenExpiredError("no object claims", new Date()),
                decoded: undefined,
            };
        }

        if (claims) {
            const username = claims["username"];
            // @ts-ignore
            const publicKeyResult = await pgClient.connection.query(
                `
                SELECT public_key
                from users_identity
                where username = $1
            `,
                [username],
            );
            if (publicKeyResult.rowCount < 1) {
                return {
                    decodeError: new TokenExpiredError("no pk", new Date()),
                    decoded: undefined,
                };
            }

            const rawPublicKey = publicKeyResult.rows[0].public_key.replace(/\\n/gm, "\n");
            const publicKey =
                "-----BEGIN PUBLIC KEY-----\n" +
                `${rawPublicKey.endsWith("\n") ? rawPublicKey : `${rawPublicKey}\n`}` +
                "-----END PUBLIC KEY-----\n`";

            let decodeError = undefined;
            let decoded = undefined;
            jwt.verify(
                token,
                publicKey,
                {
                    algorithms: [algorithm],
                },
                (err, _decoded) => {
                    decodeError = err;
                    decoded = _decoded;
                },
            );
            return { decodeError, decoded };
        } else {
            return {
                decodeError: new TokenExpiredError("no claims yo", new Date()),
                decoded: undefined,
            };
        }
    } else {
        return { decodeError: new TokenExpiredError("no token", new Date()), decoded: undefined };
    }
};

export const auth = (
    req: Request,
    res: Response,
    pgClient: DBClient,
    next: ({ username }: { username: string }) => Promise<void>,
) => authHelper(JWT_CUSTOMER_ALGORITHM, req, res, next, pgClient);

export const authWithDeviceId = (
    req: Request,
    res: Response,
    pgClient: DBClient,
    next: ({ username, deviceId }: { username: string; deviceId: string }) => Promise<void>,
) => authHelper(JWT_CUSTOMER_ALGORITHM, req, res, next, pgClient);

export const MOCK_PUBLIC_KEY = `MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA6lORI0goLg5HUlkcnnAO
plNP9RF6QfHQ3EyS8aBEkxYVtQhvrG+cIN0X5ws48wqsCm3/fCQtwPghuDuCXRG8
rJTxWr5eUOy49HATRMHIdWSSG8sdz2SH//5lDu9u6u6QtUflYPEmNXCwZAzhhaWs
DhqYkBIbNKcCnspzI/itw7znaKdfSNQvXYWuT7LvDQAjorP+JJfy8JCQzHweT52F
BU/By9KOl6XyeOqwPc4gcKBj72KWSczwqhM0fxAFaKc/xSRxMYbKCPPGXq1TqS1l
xHLNHqMBvewxoM6eYHFvO5jekbLbdObh+irwwx1HlG24lYwGTc/7bDBkqMWTrvg+
VE4oCweIRi93pW21MLxUIZeH7G4gmPutwgY6gaZEYoKY9gvlupGU5TDZvF5Ny69F
rs3OJF4m9Lp7IQKdOCvnXnug6XB67vSc3a13kDygkTTfBVT8gdkb0yGkyhGwG2VA
9TGyxGgYFSVHHFW6vPl65b0ksLiED5twulJ4kzb4trEaayrqvYMgoNnq967RuOcp
nNQ885Uit5HTfNaU8/aRWnkDy/ItZCwzkABkP0GNLAKLKZ6hrtu5gHeVqi1xTvXx
pai+Emj+NmxkhpPsWFqCQznnLQ/BNBhQn/EtMU03W3Q6nA0QO1o37w8b/689dWwV
cMTE2BCIg/sAjsqQ8I9zEskCAwEAAQ==\n`;

export const MOCK_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
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
-----END RSA PRIVATE KEY-----\n`;

export const generateJwtTokenHelper = (privateKey: string, payload: object): string =>
    jwt.sign(payload, privateKey, { algorithm: JWT_CUSTOMER_ALGORITHM, expiresIn: "1d" });
