Summary

Custom Redis that uses Google Cloud Storage to store the snapshots

Get shell

kubectl exec --stdin --tty redis-7744d5b884-b9bx2 -- /bin/ash

Read config

```
redis-cli
config get save
```

GET ALL dictionaries:

```
KEYS *
```
