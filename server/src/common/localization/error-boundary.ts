import { Request, Response } from "express";

import { LocalizableError, LocalizedError } from "./localization";
import { ValidationError2 } from "../sanitizer";
import { logger } from "../logger";

export const withErrorBoundary = async (req: Request, res: Response, body: () => any) => {
    try {
        await body();
    } catch (e) {
        if (req.headers) {
            logger.error(JSON.stringify(req.headers));
        }
        if (req.body && req.url) {
            logger.error(req.url);
            logger.error(JSON.stringify(req.body));
        }
        if (e.message) {
            logger.error(e.message);
        } else {
            logger.error(e);
        }
        if (e.stack) {
            logger.error(e.stack);
        }
        if (e instanceof LocalizableError) {
            const localized = LocalizedError.build(
                e.id,
                e.httpCode,
                req,
                e.engineeringError,
                ...e.params,
            );
            if (e.engineeringError) {
                logger.error(`Engineering error ${e.engineeringError}`);
            }
            res.status(e.httpCode).send({
                success: false,
                result: {
                    message: localized.message,
                    engineeringError: e.engineeringError ? e.engineeringError : localized.message,
                },
            });
        } else if (e instanceof ValidationError2) {
            res.status(400).send({
                success: false,
                result: { message: e.message, engineeringError: e.message },
            });
        } else {
            res.status(501).send({
                success: false,
                result: { message: e.message, engineeringError: e.message },
            });
        }
    }
};
