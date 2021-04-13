process.env.TWILIO_ACCOUNT_SID = "ACblah"
process.env.TWILIO_AUTH_TOKEN = "blah"
process.env.TWILIO_NUMBER = "blah"
process.env.LABS_MOBILE_USERNAME = "blah"
process.env.LABS_MOBILE_PASSWORD = "blah"

import { SMSSender } from "./sms-sender";


describe("Notifications Server", () => {
    describe("SMSSender", () => {
        let sender: SMSSender
        beforeAll(() => {
            sender = new SMSSender()
        });
        test("Sends MEX sms to labsMobile", () => {
            const phoneNumber = "+524771234333"

        });
        test("Sends USA sms to twilio", () => {

        });
    })
});
