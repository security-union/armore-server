import axios from 'axios';
import { SmsRequest } from "./sms-sender";

export class LabsMobile {
    username: string;
    password: string;

    constructor(username: string, password: string) {
        this.username = username;
        this.password = password;
    }

    sendSms = async (smsRequest: SmsRequest) => {
        let url = `https://api.labsmobile.com/get/send.php?username=${this.username}&password=${this.password}&message=${smsRequest.body}&msisdn=${smsRequest.to}`
        return await axios.get(url);
    };
}
