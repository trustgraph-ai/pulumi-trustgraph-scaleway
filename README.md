
# Deploy TrustGraph in a Scaleway Kubernetes cluster using Pulumi

## Overview

This is an installation of TrustGraph on Scaleway using the Kubernetes
platform.

The full stack includes:

- A Kubernetes cluster
- Node pool containing 2 nodes
- An IAM application plus policy granting Gen AI access
- Deploys a complete TrustGraph stack of resources in AKS

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
- `trustgraph-scaleway:ai-model` - the AI model, look on the Generative AI
  page of the console to see other options.  Try mistral-nemo-instruct-2407.

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

## Use the system

To get access to TrustGraph using the `kube.cfg` file, set up some
port-forwarding.  You'll need multiple terminal windows to run each of
these commands:

```
kubectl --kubeconfig kube.cfg -n trustgraph port-forward service/api-gateway 8088:8088
kubectl --kubeconfig kube.cfg -n trustgraph port-forward service/workbench-ui 8888:8888
kubectl --kubeconfig kube.cfg -n trustgraph port-forward service/grafana 3000:3000
```

This will allow you to access Grafana and the Workbench UI from your local
browser using `http://localhost:3000` and `http://localhost:8888`
respectively.


## Deploy

```
pulumi destroy
```

Just say yes.

## How the config was built

There's an AI model specified in config.json. Available AI models can be
found in Scaleway docs.
- `mistral-nemo-instruct-2407`
- `mixtral-8x7b-instruct-0123`
- `llama-3-8b-instruct`
- `codestral-2405`

The AI model specified in the config.json should match the model in the
AI endpoint hostname specified in the Pulumi config.

```
python3 -m venv env
. env/bin/activate
pip install --upgrade git+https://github.com/trustgraph-ai/trustgraph-templates@5e839db05e9e278374d510c9cdd0c02ade12aabd
tg-configurator -t 1.4 -v 1.4.19 --platform scw-k8s -R > resources.yaml
```
