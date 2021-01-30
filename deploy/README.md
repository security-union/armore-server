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

### Create the LoadBalancer and Nginx Controller

Shout out to this repo https://github.com/kubernetes/ingress-nginx/ 

```
helm install ingress-nginx ingress-nginx/ingress-nginx
# Then get the external ip
kubectl --namespace default get services -o wide -w ingress-nginx-controller
```

Setup a Cloud DNS route for the external ip


