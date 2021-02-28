# Armore Deploy

## Prerequisites

Make sure you have this stuff installed and setup

1. [terraform](https://www.terraform.io/downloads.html)
1. [gcloud sdk](https://cloud.google.com/sdk/docs/install)
1. [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/)
1. [helm v3](https://helm.sh/docs/intro/install/)

## Deploying

### Create the cluster, network, and node pool

We use terraform to create our cloud infrastructure.

**You must have a gcloud project already**

```
cd terraform/dev
terraform apply -var 'name=dev' -var 'region=us-west1' -var 'project_id=<your-project-id>'
```

### Create the LoadBalancer, Nginx Controller, Certificate Manager

Shout out to this repo https://github.com/kubernetes/ingress-nginx/ 

```
helm install ingress-nginx ingress-nginx/ingress-nginx

# Then get the external ip for the load balancer
kubectl --namespace default get services -o wide -w ingress-nginx-controller

# Apply nginx custom config-map
kubectl apply -f nginx-config.yaml
```

Setup a Cloud DNS route for the external ip

Install cert-manager to handle the tls certs

```
kubectl create namespace cert-manager
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install \
  cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --version v1.1.0 \
  --set installCRDs=true
```

Create a cluster issuer

```
kubectl apply -f cluster-issuer.yaml -n cert-manager
```

### Deploy Armore

```
kubectl create namespace dev
helm install dev ./chart -f chart/secrets/dev.yaml -n dev
```
