process.env.TWILIO_ACCOUNT_SID = "ACblah"
process.env.TWILIO_AUTH_TOKEN = "blah"
process.env.TWILIO_NUMBER = "blah"
process.env.LABS_MOBILE_USERNAME = "blah"
process.env.LABS_MOBILE_PASSWORD = "blah"

import { AlphaSenderContext } from "twilio/lib/rest/messaging/v1/service/alphaSender"
import { SMSSender } from ".";


describe("Notifications Server", () => {
    describe("SMSSender", () => {
        let sender: SMSSender
        beforeAll(() => {
            sender = new SMSSender()
        });
        test("Sends MEX sms to labsMobile", () => {
            const phoneNumber = "+524771234333"
            sender.PROVIDER_MAP
        });
        test("Sends USA sms to twilio", () => {

        });
    })
});
