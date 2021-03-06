use chrono::{Duration, Local};
use std::env;
use std::thread;

use lib::constants::TELEMETRY_LAST_SEEN_SET;
use lib::controllers::telemetry::force_refresh_telemetry_internal;
use lib::db::get_pool;
use rocket_sentry_logger::{self as logger, InitConfig};

use log::{debug, error, info};
use redis::Commands;
/**
Nanny is a program that has the following jobs:

1. Ping iOS devices every 10 minutes.

2. Notify users when they have been offline for more than 1 hour.
**/

fn main() {
    env_logger::init();
    info!("Starting");
    let dsn = std::env::var("SENTRY_DSN");
    if let Ok(dsn) = dsn {
        let _guard = logger::init(
            dsn,
            Some(InitConfig {
                service: Some("Nanny"),
                ..Default::default()
            }),
        );
    } else {
        debug!("SENTRY_DSN env var not found so not using sentry.");
    }

    let redis_url = env::var("REDIS_URL").expect("REDIS_URL must be set");

    // If now() - timestamp < ONLINE_THRESHOLD then the user is considered to be "online"
    let online_threshold_minutes: i64 = env::var("ONLINE_THRESHOLD_MINUTES")
        .expect("ONLINE_THRESHOLD_MINUTES must be set")
        .parse()
        .expect("ONLINE_THRESHOLD_MINUTES was in a bad format. Must be i64");
    let offline_cut_off_minutes: i64 = env::var("OFFLINE_CUT_OFF_MINUTES")
        .expect("OFFLINE_CUT_OFF_MINUTES must be set")
        .parse()
        .expect("OFFLINE_CUT_OFF_MINUTES was in a bad format. Must be i64");
    let poll_period_seconds: u64 = env::var("POLL_PERIOD_SECONDS")
        .expect("POLL_PERIOD_SECONDS must be set")
        .parse()
        .expect("POLL_PERIOD_SECONDS was in a bad format. Must be u64");
    start_run_loop(
        &redis_url,
        &online_threshold_minutes,
        &offline_cut_off_minutes,
        &poll_period_seconds,
    );
}

fn start_run_loop(
    redis_url: &String,
    online_threshold_minutes: &i64,
    offline_cut_off_minutes: &i64,
    poll_period_seconds: &u64,
) {
    let db_client = get_pool();
    let redis_client =
        redis::Client::open(redis_url.clone()).expect("Failed to open redis client.");
    loop {
        debug!("on tick");
        let now = Local::now();
        let window_start = now - Duration::minutes(*online_threshold_minutes);
        let window_end = now - Duration::minutes(*offline_cut_off_minutes);
        let mut redis_connection = redis_client
            .get_connection()
            .expect("Failed to connect to redis server.");

        // 1. fetch redis and determine who needs to be pinged.
        let users_to_ping: Vec<(String, i64)> = redis_connection
            .zrangebyscore_withscores(
                &TELEMETRY_LAST_SEEN_SET.to_string(),
                window_end.timestamp(),
                window_start.timestamp(),
            )
            .unwrap();

        debug!("number of users to notify {}", users_to_ping.len());
        for offline_user in &users_to_ping {
            let username: &String = &offline_user.0;

            debug!("sending background refresh to {}", username);
            let mut client = db_client.get().expect("Failed to open db client.");
            let force_refresh_result = force_refresh_telemetry_internal(
                &mut client,
                username.to_string(),
                "nanny".to_string(),
            );

            if let Err(_) = force_refresh_result {
                error!("force_result error")
            }
        }
        thread::sleep(std::time::Duration::from_secs(*poll_period_seconds));
    }
}
