import { Phone } from "./phone";
import { generateJwtTokenHelper, MOCK_PRIVATE_KEY } from "../common/authentication";

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

const PORT = 9080;
const deviceInfo = { deviceId: process.env.DEVICE_ID, username: process.env.USERNAME };
const jwtToken = generateJwtTokenHelper(MOCK_PRIVATE_KEY, {
    ...deviceInfo,
});

console.log("token", jwtToken);
async function w() {
    const phone = new Phone({
        timeout: 10000,
        serverUrl: `ws://localhost:${PORT}`,
        jwtToken,
        onMsg: () => {},
    });

    await phone.connect();

    phone.onMsg = (msg: Buffer) => {
        console.log("on message", msg.toString());
    };
}

w();
