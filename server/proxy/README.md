Build

```
docker build . -t nginx-proxy:local
```

move to k8s

```
docker save nginx-proxy > nginx-proxy.tar
microk8s.ctr -n k8s.io image import nginx-proxy.tar
```

```
microk8s.kubectl apply -f deployment.yaml
```
