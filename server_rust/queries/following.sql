SELECT users_followers.username,
       users_followers.username_follower,
       users_followers.access_type,
       joined.encrypted_location,
       joined.creation_timestamp,
       user_details.first_name,
       user_details.last_name,
       users.email,
       users_state.self_perception
FROM users_followers
         LEFT JOIN (
    SELECT *
    FROM device_telemetry
             JOIN (
        SELECT device_telemetry.username, max(device_telemetry.creation_timestamp) AS MaxDate
        FROM device_telemetry
        WHERE device_telemetry.recipient_username = 'dario'
        GROUP BY device_telemetry.username
    ) tm ON device_telemetry.creation_timestamp = tm.MaxDate
) AS joined
                   ON joined.recipient_username = users_followers.username_follower
         INNER JOIN user_details ON user_details.username = users_followers.username
         INNER JOIN users ON users.username = users_followers.username
         INNER JOIN users_state ON users_state.username = users_followers.username
WHERE username_follower = 'dario';

-- Following without location

SELECT users_followers.username,
       users_followers.username_follower,
       users_followers.access_type,
       user_details.first_name,
       user_details.last_name,
       users.email,
       users_state.self_perception
FROM users_followers
         INNER JOIN user_details ON user_details.username = users_followers.username
         INNER JOIN users ON users.username = users_followers.username
         INNER JOIN users_state ON users_state.username = users_followers.username
WHERE username_follower = 'dario';
