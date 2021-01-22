# Armore Helm Chart

This is a helm chart for the Armore Location Tracker backend.

## Secret Management -- CONFIGURE THIS FIRST IF DEPLOYING PROD

For Armore production secrets see this [private internal doc](https://docs.google.com/document/d/1pLc6vYPQe3y9NKxkGtyFXaY8APRlflLRtKOnMWV_4oc/edit#) this must be kept secret to protect our users.

## How to deploy

Steps for deploying
1. You need to have a postgres (version 12+) database running.
1. Create a custom values.yaml file in the secrets/ directory for each one of your envs
1. Deploy it!

Deploy command
```
helm install armore . -f secrets/custom-values-for-production.yaml
```

### Local Setup

#### Install minikube

```
brew install minikube
```

#### Create a cluster

```
minikube start --vm=true
```

#### Configure the gcr credentials

```
minikube addons configure registry-creds
```

Choose yes for gcr, Google container registry, and give a path to the service account json file that has read access.

#### Create a postgresql database

The armore backend depends on a postgresql database. If you already have one running you can skip this step.

To deploy on kubernetes with helm use the [bitnami/postgresql helm chart](https://github.com/bitnami/charts/tree/master/bitnami/postgresql).

```
helm install lobster bitnami/postgresql --set image.tag="12.5.0-debian-10-r51"
```

Determine what the host and password is from the output

Host example:
```
lobster-postgresql.default.svc.cluster.local
```

Get password and save for next step:
```
kubectl get secret --namespace default lobster-postgresql -o jsonpath="{.data.postgresql-password}" | base64 --decode
```

#### Deploy armore

Deploy the armore backend

```
helm install armore . -f secrets/custom-values-for-local.yaml
```
