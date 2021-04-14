process.env.TWILIO_ACCOUNT_SID = "ACblah";
process.env.TWILIO_AUTH_TOKEN = "blah";
process.env.TWILIO_NUMBER = "blah";
process.env.LABS_MOBILE_USERNAME = "blah";
process.env.LABS_MOBILE_PASSWORD = "blah";

import { SMSSender } from "./sms-sender";

describe("Notifications Server", () => {
    describe("SMSSender", () => {
        let sender: SMSSender;
        beforeAll(() => {
            sender = new SMSSender();
        });
        test("Sends MEX sms to labsMobile", () => {
            const phoneNumber = "+524771234333";
            const smsRequest = {
                body: "bla",
                to: phoneNumber,
            };
            const [twilio, labsMobile] = sender.mapPhoneNumberToProvider([smsRequest]);
            expect(twilio).toHaveLength(0);
            expect(labsMobile).toHaveLength(1);
        });
        test("Sends USA sms to twilio", () => {
            const phoneNumber = "+12455436345";
            const smsRequest = {
                body: "bla",
                to: phoneNumber,
            };
            const [twilio, labsMobile] = sender.mapPhoneNumberToProvider([smsRequest]);
            expect(twilio).toHaveLength(1);
            expect(labsMobile).toHaveLength(0);
        });
        test("Sends COL sms to LabsMobile", () => {
            const phoneNumber = "+573044469588";
            const smsRequest = {
                body: "bla",
                to: phoneNumber,
            };
            const [twilio, labsMobile] = sender.mapPhoneNumberToProvider([smsRequest]);
            expect(twilio).toHaveLength(0);
            expect(labsMobile).toHaveLength(1);
        });
    });
});
