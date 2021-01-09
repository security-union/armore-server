# Redis

How to connect to a Redis instance?

```
redis-cli -h <google-ip>  -p 6379 ping
```

## SETS

## Add elements to set

```
127.0.0.1:6379> ZADD telemetry.last.seen 1597525827907 "dario"
(integer) 1
127.0.0.1:6379> ZADD telemetry.last.seen 2597525827907 "maye"
(integer) 1
127.0.0.1:6379> ZADD telemetry.last.seen 1597818554 "romina"
(integer) 1
```

## Query elements

```
127.0.0.1:6379> ZRANGEBYSCORE telemetry.last.seen 2597525827907 3597525827907
1) "maye"
2) "romina"
127.0.0.1:6379> ZRANGEBYSCORE telemetry.last.seen 2597525827907 3597525827906
1) "maye"
127.0.0.1:6379> ZRANGEBYSCORE telemetry.last.seen 2597525827907 3597525827906 true
(error) ERR syntax error
127.0.0.1:6379> ZRANGEBYSCORE telemetry.last.seen 2597525827907 3597525827906 'WITHSCORES'
1) "maye"
2) "2597525827907"
127.0.0.1:6379> ZRANGEBYSCORE telemetry.last.seen 2597525827907 3597525827907 'WITHSCORES'
1) "maye"
2) "2597525827907"
3) "romina"
4) "3597525827907"
```

## Get all elements from a ZSET

```
ZRANGE telemetry_last_seen 0 -1 'WITHSCORES'
```

## Get All keys from a hash set

```
HGETALL nanny_poke_retry_map
```

## Delete Map

```
DEL nanny_poke_retry_map
```

## Delete Map key

```
HDEL nanny_poke_retry_map dariocloud
```

## Connect to running redis instance

```
kubectl exec --stdin --tty redis-64bfdbbc56-z5tst -- /bin/ash
```
