use core::panic;
use std::time::Duration;

use amiquip::{
    Channel, ConsumerMessage, ConsumerOptions, ExchangeDeclareOptions, ExchangeType, FieldTable,
    Queue, QueueDeclareOptions,
};

use lib::messaging::{NOTIFICATIONS_EXCHANGE, NOTIFICATIONS_ROUTING_KEY};

pub fn bind_notifications_queue(channel: &Channel) -> Queue {
    let queue = channel
        .queue_declare("notifications", QueueDeclareOptions::default())
        .unwrap();
    let exchange = channel
        .exchange_declare(
            ExchangeType::Direct,
            NOTIFICATIONS_EXCHANGE,
            ExchangeDeclareOptions::default(),
        )
        .unwrap();
    queue
        .bind(&exchange, NOTIFICATIONS_ROUTING_KEY, FieldTable::default())
        .unwrap();
    queue.purge_nowait().unwrap();
    queue
}

pub fn consume_message(queue: &Queue) -> Vec<u8> {
    let consumer = queue.consume(ConsumerOptions::default()).unwrap();
    let message = consumer
        .receiver()
        .recv_timeout(Duration::from_millis(1000))
        .unwrap();
    match message {
        ConsumerMessage::Delivery(delivery) => {
            let message = delivery.body.clone();
            consumer.ack(delivery).unwrap();
            message
        }
        _ => panic!("Error delivering rabbitmq message!"),
    }
}
