import { Request } from "express";

import english from "./english";
import spanish from "./spanish";
import { Trans } from "./translation";
import { format } from "util";

export enum Language {
    English = "en",
    Spanish = "es",
}

export const ACCEPT_LANGUAGE_HTTP_HEADER = "accept-language";

export const translate = (id: Trans, request: Request, ...params: any[]): string =>
    translateWithFormat(id, request.get(ACCEPT_LANGUAGE_HTTP_HEADER), ...params);

export const language = (lang: string | undefined): Language => {
    switch (lang) {
        case Language.Spanish:
            return Language.Spanish;
        default:
            return Language.English;
    }
};

export const translateWithFormat = (
    id: Trans,
    lang: string | undefined,
    ...params: any[]
): string => {
    switch (lang) {
        case Language.Spanish:
            return format(spanish[id], ...params);
        default:
            return format(english[id], ...params);
    }
};

export class LocalizableError extends Error {
    engineeringError: string | undefined;
    id: Trans;
    httpCode: number;
    params: any[];

    constructor(
        id: Trans,
        httpCode: number,
        engineeringError: string | undefined = undefined,
        ...params: any[]
    ) {
        super(engineeringError ? engineeringError : "");
        this.id = id;
        this.engineeringError = engineeringError;
        this.httpCode = httpCode;
        this.params = params;
    }
}

export class LocalizedError extends Error {
    engineeringError: string | undefined;
    httpCode: number;
    private params: any[] | undefined;

    constructor(
        id: Trans,
        httpCode: number,
        lang: Language,
        engineeringError: string | undefined,
        ...params: any[]
    ) {
        super(translateWithFormat(id, lang, ...params));
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, LocalizedError);
        }
        this.engineeringError = engineeringError;
        this.httpCode = httpCode;
        this.params = params;
    }

    static build = (
        id: Trans,
        httpCode: number,
        request: Request,
        engineeringError: string | undefined = undefined,
        ...params: any[]
    ) =>
        LocalizedError.build2(
            id,
            httpCode,
            language(request.get(ACCEPT_LANGUAGE_HTTP_HEADER)),
            engineeringError,
            ...params,
        );

    static build2 = (
        id: Trans,
        httpCode: number,
        lang: Language,
        engineeringError: string | undefined = undefined,
        ...params: any[]
    ) => new LocalizedError(id, httpCode, lang, engineeringError, ...params);
}
