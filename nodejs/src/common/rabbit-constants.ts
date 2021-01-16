import { ExchangeOptions } from "./rabbit-helpers";
import { Options } from "amqplib";

export const notificationsExchange: ExchangeOptions = {
    type: "direct",
    name: "notifications.exchange",
    durable: false,
    pattern: "notifications",
};

export const websocketExchange: ExchangeOptions = {
    type: "topic",
    name: "websocket.exchange",
    durable: false,
    pattern: "location.*.*",
};

export const NOTIFICATIONS_ROUTING_KEY = "notifications";

export const NOTIFICATIONS_SERVER_DELIVERY_OPTIONS_EXPIRE_1_HOUR: Options.Publish = {
    expiration: 60 * 60 * 1000, // 1 hour;
};

export const NOTIFICATIONS_SERVER_DELIVERY_OPTIONS_EXPIRE_15_MINUTES: Options.Publish = {
    expiration: 60 * 15 * 1000, // 15 minutes;
};
