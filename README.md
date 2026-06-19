
# Deploy TrustGraph in a Scaleway Kubernetes cluster using Pulumi

## Overview

This is an installation of TrustGraph on Scaleway using the Kubernetes
platform.

The full stack includes:

- A Kubernetes cluster
- Node pool containing 4 nodes
- An IAM application plus policy granting Gen AI access
- Deploys a complete TrustGraph stack of resources in Kubernetes
- Nginx Gateway Fabric for ingress with Gateway API
- cert-manager with Let's Encrypt TLS certificates
- HTTPS access to TrustGraph UI and Grafana via public DNS names

Keys and other configuration for the AI components are configured into
TrustGraph using secrets.

The Pulumi configuration configures a Mistral nemo instruct endpoint.

## How it works

This uses Pulumi which is a deployment framework, similar to Terraform
but:
- Pulumi has an open source licence
- Pulumi uses general-purposes programming languages, particularly useful
  because you can use test frameworks to test the infrastructure.

Roadmap to deploy is:
- Install Pulumi
- Setup Pulumi
- Configure your environment with Scaleway credentials, generate an API key
- Modify the local configuration to do what you want
- Deploy
- Use the system

Setting the keys up from the API key looks like this...

```
export SCW_ACCESS_KEY=KEYGOESHERE
export SCW_SECRET_KEY=SECRETKEYGOESHERE
export SCW_DEFAULT_ORGANIZATION_ID=ORGKEYGOESHERE
export SCW_DEFAULT_PROJECT_ID=PROJECTKEYGOESHERE
```

# Deploy

## Deploy Pulumi

```
cd pulumi
```

Then:

```
npm install
```

## Setup Pulumi

Pulumi can use a secret to encrypt secrets in state information.  This
turns it off...

```
export PULUMI_CONFIG_PASSPHRASE=
```

You need to tell Pulumi which state to use.  You can store this in an S3
bucket, but for experimentation, you can just use local state:

```
pulumi login --local
```

Pulumi operates in stacks, each stack is a separate deployment.  The
git repo contains the configuration for a single stack `scaleway`, so you
could:

```
pulumi stack init scaleway
```

and it will use the configuration in `Pulumi.scalway.yaml`.

## Configure your environment with Scaleway credentials

In the console, create an API key for yourself 
and set the environment variables as instructed:

```
export SCW_ACCESS_KEY=xxxxxxxxxxxxxxx
export SCW_SECRET_KEY=xxxxxxxxxxxxxxx
export SCW_DEFAULT_ORGANIZATION_ID=xxxxxxxxxxxxxx
export SCW_DEFAULT_PROJECT_ID=xxxxxxxxxxxxxx
```

## Modify the local configuration to do what you want

You can edit:
- settings in `Pulumi.STACKNAME.yaml` e.g. Pulumi.scaleway.yaml
- change `resources.yaml` with whatever you want to deploy.
  The resources.yaml file was created using the TrustGraph config portal,
  so you can re-generate your own.

The `Pulumi.STACKNAME.yaml` configuration file contains settings for:

- `trustgraph-scaleway:region` - Scaleway deployment location (e.g. fr-par).
- `trustgraph-scaleway:environment` - Name of the environment you are deploying
  use a name like: dev, prod etc.
- `trustgraph-scaleway:domain` - Domain name for the TrustGraph UI
  (e.g. app.example.com).
- `trustgraph-scaleway:grafana-domain` - Domain name for Grafana
  (e.g. grafana.example.com).
- `trustgraph-scaleway:letsencrypt-email` - Email address for Let's Encrypt
  certificate registration.

## Deploy

```
pulumi up
```

Just say yes.

If everything works:
- A file `kube.cfg` will also be created which provides access
  to the Kubernetes cluster.

To connect to the Kubernetes cluster...

```
kubectl --kubeconfig kube.cfg -n trustgraph get pods
```

If something goes wrong while deploying, retry before giving up.
`pulumi up` is a retryable command and will continue from
where it left off.

## DNS setup

After deployment, get the LoadBalancer IP assigned to the gateway:

```
kubectl --kubeconfig kube.cfg -n nginx-gateway get svc
```

Create DNS A records pointing both your domain and grafana-domain at this
IP address.  cert-manager will automatically obtain Let's Encrypt TLS
certificates once DNS resolves.

## Use the system

Once DNS is configured, access the services at:

- TrustGraph UI: `https://<your-domain>`
- Grafana: `https://<your-grafana-domain>`

Alternatively, you can use port-forwarding with the `kube.cfg` file:

```
kubectl --kubeconfig kube.cfg -n trustgraph port-forward service/api-gateway 8088:8088
kubectl --kubeconfig kube.cfg -n trustgraph port-forward service/trustgraph-ui 8888:8888
kubectl --kubeconfig kube.cfg -n trustgraph port-forward service/grafana 3000:3000
```

This will allow you to access Grafana and the TrustGraph UI from your local
browser using `http://localhost:3000` and `http://localhost:8888`
respectively.

The IAM bootstrap token and Grafana admin password are auto-generated
by Pulumi.  After deployment, retrieve them with:
```
pulumi stack output iamToken --show-secrets
pulumi stack output grafanaPassword --show-secrets
```

Login to Grafana with username `admin` and the password from the command
above.

To use the TrustGraph API with authentication:
```
export TRUSTGRAPH_TOKEN=$(pulumi stack output iamToken --show-secrets)
```


## Destroy

```
pulumi destroy
```

Just say yes.

## How the config was built

There's an AI model specified in config.json. Available AI models can be
found in Scaleway docs.

The AI model specified in the config.json should match the model in the
AI endpoint hostname specified in the Pulumi config.

```
./update-config scw-k8s 2.5.16
```
