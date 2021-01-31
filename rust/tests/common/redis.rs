use lib::controllers::telemetry::redis_hash_map_name;
use std::env;
use redis::Commands;

pub fn flush_redis() {
    let mut redis =
        redis::Client::open(env::var("REDIS_URL").expect("REDIS_URL must be set")).unwrap();
    redis
        .del::<String, ()>(redis_hash_map_name("dario"))
        .unwrap();
    redis
        .del::<String, ()>(redis_hash_map_name("louisck"))
        .unwrap();
    redis
        .del::<String, ()>(redis_hash_map_name("billburr"))
        .unwrap();
}
