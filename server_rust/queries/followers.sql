/*
 * *
 *  * Copyright [2018] [Dario Alessandro Lencina Talarico]
 *  * Licensed under the Apache License, Version 2.0 (the "License");
 *  * y ou may not use this file except in compliance with the License.
 *  * You may obtain a copy of the License at
 *  * http://www.apache.org/licenses/LICENSE-2.0
 *  * Unless required by applicable law or agreed to in writing, software
 *  * distributed under the License is distributed on an "AS IS" BASIS,
 *  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  * See the License for the specific language governing permissions and
 *  * limitations under the License.
 *
 *
 */
SELECT users.username,
       users.email,
       followers_query.num_of_followers,
       following_query.num_of_following,
       (followers_query.num_of_followers + following_query.num_of_following) as total_connections
FROM users
         FULL JOIN
     (SELECT users.username, count(users_followers.username_follower) AS num_of_followers
      FROM users
               LEFT JOIN users_followers
                         ON users.username = users_followers.username
      GROUP BY (users.username)) AS followers_query
     ON users.username = followers_query.username
         FULL JOIN
     (SELECT users.username, count(users_followers.username) AS num_of_following
      FROM users
               FULL JOIN users_followers
                         ON users.username = users_followers.username_follower
      GROUP BY (users.username)) AS following_query
     ON users.username = following_query.username
WHERE 1 = 1[[ AND users.username = {{username_var}}]]
[[AND (users.email = {{email_var}} OR users.phone_number = {{email_var}})]]
ORDER BY total_connections asc;


-- Get people with and without connections count

SELECT sum(case when total_connections > 0 then 1 else 0 end) as people_with_connections,
       sum(case when total_connections = 0 then 1 else 0 end) as people_without_connections
FROM (SELECT users.username,
             followers_query.num_of_followers,
             following_query.num_of_following,
             (followers_query.num_of_followers + following_query.num_of_following) as total_connections
      FROM users
               FULL JOIN
           (SELECT users.username, count(users_followers.username_follower) AS num_of_followers
            FROM users
                     LEFT JOIN users_followers
                               ON users.username = users_followers.username
            GROUP BY (users.username)) AS followers_query
           ON users.username = followers_query.username
               FULL JOIN
           (SELECT users.username, count(users_followers.username) AS num_of_following
            FROM users
                     FULL JOIN users_followers
                               ON users.username = users_followers.username_follower
            GROUP BY (users.username)) AS following_query
           ON users.username = following_query.username) AS connections