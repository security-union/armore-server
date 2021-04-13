import phone from "phone";
import { logger } from "../common/logger";
import { partition } from "lodash";
import { Twilio } from "twilio";
import {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_NUMBER,
    LABS_MOBILE_PASSWORD,
    LABS_MOBILE_USERNAME,
} from "../common/constants";
import { LabsMobile } from "./labs-mobile";

export interface SmsRequest {
    body: string;
    to: string;
}

export class SMSSender {
    twilio: Twilio;
    labsMobile: LabsMobile;

    PROVIDER_MAP: { [key: string]: string } = {
        MEX: "labsMobile",
        COL: "labsMobile",
    };

    constructor() {
        if (LABS_MOBILE_USERNAME !== "" && LABS_MOBILE_PASSWORD !== "") {
            this.labsMobile = new LabsMobile(LABS_MOBILE_USERNAME, LABS_MOBILE_PASSWORD);
        } else {
            throw new Error(
                "Invalid configuration. Must set env vars LABS_MOBILE_USERNAME and LABS_MOBILE_PASSWORD",
            );
        }

        if (TWILIO_ACCOUNT_SID !== "" && TWILIO_AUTH_TOKEN !== "" && TWILIO_NUMBER !== "") {
            this.twilio = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        } else {
            throw new Error(
                "Invalid configuration. Must set env vars TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_NUMBER",
            );
        }
    }

    send = async (smsRequest: SmsRequest[]) => {
        try {
            const [twilioSms, labsMobileSms] = this.mapPhoneNumberToProvider(smsRequest);
            const twilioPromises = twilioSms.flatMap((sms) => {
                this._sendTwilio(sms);
            });
            const labsMobilePromises = labsMobileSms.flatMap((sms) => {
                this._sendLabsMobile(sms);
            });
            const promises = twilioPromises.concat(labsMobilePromises);
            return Promise.allSettled(promises);
        } catch (e) {
            return Promise.reject(e);
        }
    };

    mapPhoneNumberToProvider = (smsRequest: SmsRequest[]): [SmsRequest[], SmsRequest[]] => {
        return partition(smsRequest, (req) => {
            const [_, countryCode] = phone(req.to);
            if (this.PROVIDER_MAP[countryCode] !== undefined) {
                return false;
            } else {
                return true;
            }
        });
    };

    _sendLabsMobile = async (smsRequest: SmsRequest) => {
        try {
            return this.labsMobile.sendSms(smsRequest);
        } catch (e) {
            return Promise.reject(e);
        }
    };

    _sendTwilio = async (smsRequest: SmsRequest) => {
        try {
            return this.twilio.messages
                .create({ ...smsRequest, from: TWILIO_NUMBER })
                .then((message) => logger.debug("Sent sms sid: ", message.sid))
                .catch((reason) => logger.error("Unable to send sms ", reason));
        } catch (e) {
            return Promise.reject(e);
        }
    };
}
