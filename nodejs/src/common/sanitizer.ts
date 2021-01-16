import { ValidationError, Result } from "express-validator";
import { Request } from "express";
import phone from "phone";
import { translate } from "./localization/localization";
import { Trans } from "./localization/translation";

export class ValidationError2 extends Error {
    constructor(error: string) {
        super(error);
    }
}

export const createError = (errors: Result<ValidationError>, req: Request): Error => {
    const validationWithValue = translate(Trans.ValidationWithValue, req);
    const validationIsInvalid = translate(Trans.ValidationIsInvalid, req);
    return new ValidationError2(
        `${errors
            .array()
            .map(
                ({ value, param }) =>
                    `${param} ${validationWithValue} '${value}' ${validationIsInvalid}`,
            )
            .join("\n")}`,
    );
};

export const isEmail = (str: string): boolean => {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(str.toLowerCase());
};

export const isBase64 = (str: string): boolean => {
    const re = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/;
    return re.test(str);
};

export const getPhoneE164 = (str: string, req: Request | undefined): string => {
    const phoneNumber = phone(str, "")[0];
    if (!phoneNumber) {
        if (req) {
            throw new ValidationError2(translate(Trans.InvalidPhoneNumber, req));
        } else {
            throw new ValidationError2("Phone number is not in a valid format");
        }
    }
    return phoneNumber;
};

export const getSanitizedPhone = (str: string, req: Request | undefined): string => {
    return getPhoneE164(str, req);
};

export const getSanitizedEmail = (str: string): string | undefined => {
    if (isEmail(str)) {
        return str.toLocaleLowerCase();
    }
    return undefined;
};

export const getSantizedEmailOrPhone = (str: string, req: Request | undefined): string => {
    if (isEmail(str)) {
        return str.toLocaleLowerCase();
    } else {
        return getPhoneE164(str, req);
    }
};
