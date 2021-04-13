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

import amqp, { Options } from "amqplib";

import { logger } from "./logger";
import { connect } from "./amqp-helpers";

export interface ExchangeOptions {
    type: string;
    name: string;
    durable: boolean;
    pattern: string;
}

export interface QueueOptions {
    name: string;
}

export interface MessagePayload {
    message: string;
    routingKey: string;
    exchange: string;
    options: Options.Publish | undefined;
}

export class RabbitClient {
    rabbitMQUrl: string;
    exchangeOptions: ExchangeOptions[];
    queueOptions: QueueOptions | undefined;
    channel: amqp.Channel | undefined;

    constructor(
        rabbitMQUrl: string,
        exchangeOptions: ExchangeOptions[],
        queueOptions: QueueOptions | undefined,
    ) {
        this.rabbitMQUrl = rabbitMQUrl;
        this.exchangeOptions = exchangeOptions;
        this.queueOptions = queueOptions;
    }

    start = async (): Promise<any> => {
        const connection = await connect(this.rabbitMQUrl);

        const channel = await connection.createChannel();
        this.channel = channel;

        channel.on("error", (err) => {
            logger.error(`Channel error ${JSON.stringify(err)}`);
        });

        if (this.queueOptions != undefined) {
            await this.channel.assertQueue(this.queueOptions.name, {
                exclusive: false,
                durable: false,
            });
        }

        logger.info("Starting rabbitClient with config: ");
        logger.info(`Exchange ${JSON.stringify(this.exchangeOptions)}`);
        logger.info(`Queue ${JSON.stringify(this.queueOptions)}`);

        return Promise.all(
            this.exchangeOptions.map(async (options: ExchangeOptions) => {
                await channel.assertExchange(options.name, options.type, options);
                if (this.queueOptions) {
                    return await channel.bindQueue(
                        this.queueOptions.name,
                        options.name,
                        options.pattern,
                    );
                } else {
                    return true;
                }
            }),
        );
    };

    close = async () => {
        if (this.channel) {
            await Promise.all(
                this.exchangeOptions.map(async (exchange) => {
                    if (this.channel && this.queueOptions?.name) {
                        await this.channel.unbindQueue(
                            this.queueOptions?.name,
                            exchange.name,
                            exchange.pattern,
                        );
                    }
                }),
            );
            await this.channel.close();
        }
    };

    sendMessage = ({ message, routingKey, exchange, options }: MessagePayload) => {
        if (this.channel) {
            this.channel.publish(exchange, routingKey, Buffer.from(message.toString()), options);
        } else {
            throw new Error("No channel!");
        }
    };

    consumeFromQueue = (onMessage: (msg: amqp.Message) => Promise<void>) => {
        if (this.channel && this.queueOptions) {
            this.channel.consume(this.queueOptions.name, onMessage);
        } else if (!this.channel) {
            throw new Error("No channel!");
        } else if (!this.queueOptions) {
            throw new Error("No queue");
        }
    };

    unsubscribe = async (topic: string) => {
        const channel = this.channel;
        if (!channel) {
            logger.error("no channel available");
            return;
        } else {
            await channel.deleteQueue(topic);
        }
    };
}
