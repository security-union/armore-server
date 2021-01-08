SELECT users.username, users.email, latest_timestamp_utc FROM users LEFT JOIN (
    SELECT MAX(device_telemetry.creation_timestamp) as latest_timestamp_utc, username
    FROM device_telemetry
    WHERE device_telemetry.creation_timestamp > current_timestamp - interval '{{lookback_days}} day'
    GROUP BY device_telemetry.username
) AS latest_updates ON latest_updates.username = users.username
    [[WHERE users.email = {{email}} || users.phone_number = {{email}}]]
ORDER BY latest_timestamp_utc asc
