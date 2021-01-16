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

import WebSocket from "ws";
import eventEmitter from "events";

export class Phone extends eventEmitter {
    timeout: number;
    serverUrl: string;
    jwtToken: string;
    ws: WebSocket | any;
    onMsg: (msg: Buffer) => void;
    receivedMessages: Array<string>;

    constructor({
        timeout = 500000,
        serverUrl,
        jwtToken,
        onMsg,
    }: {
        timeout: number;
        serverUrl: string;
        onMsg: (msg: Buffer) => void;
        jwtToken: string;
    }) {
        super();
        this.timeout = timeout;
        this.serverUrl = serverUrl;
        this.onMsg = onMsg;
        this.jwtToken = jwtToken;
        this.receivedMessages = [];
    }

    connect = async () =>
        new Promise((resolve, reject) => {
            let timer: any = setTimeout(() => {
                reject("timeout");
                timer = undefined;
            }, this.timeout);

            const _connect = () => {
                if (this.ws) {
                    this.ws.removeAllListeners();
                }

                this.ws = new WebSocket(this.serverUrl, {
                    headers: {
                        asimovlives: this.jwtToken,
                    },
                });
                this.ws.on("error", () => {
                    if (timer) {
                        setTimeout(() => {
                            if (timer) {
                                _connect();
                            }
                        }, 500);
                    }
                });

                this.ws.on("close", () => {
                    // console.log("close");
                    setTimeout(() => {
                        _connect();
                    }, 500);
                });

                this.ws.on("open", () => {
                    console.log("websocket is connected");
                    clearTimeout(timer);
                    timer = undefined;
                    resolve();
                    this.ws.on("message", this.onMsg);
                });

                this.ws.on("message", (message: Buffer) => {
                    this.receivedMessages.push(message.toString());
                    console.log("on message", JSON.stringify(message));
                });
            };
            _connect();
        });

    async disconnect() {
        await this.ws.close(1001, "vehicle initiated");
    }
}
