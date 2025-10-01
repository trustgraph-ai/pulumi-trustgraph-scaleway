
import * as scaleway from '@pulumiverse/scaleway';
import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import * as fs from 'fs';

import { prefix, region, nodeSize, nodeCount } from './config';

// Scaleway provider, allows setting the default region
const provider = new scaleway.Provider(
    "scaleway-provider",
    {
        region: region
    }
);

// Get project information
const project = scaleway.account.getProjectOutput(
    {},
    { provider: provider }
);

// If you know the project ID, you can work out the Generative AI endpoint
// URL
const aiUrl = project.id.apply(
    proj => `https://api.scaleway.ai/${proj}/v1`
);

// Create a private network
const privateNetwork = new scaleway.network.PrivateNetwork(
    "private-network",
    {
        name: prefix,
    },
    { provider: provider }
);

// Create a K8s cluster
const cluster = new scaleway.kubernetes.Cluster(
    "cluster",
    {
        name: prefix + "-cluster",
        version: "1.32.3",
        cni: "cilium",
        privateNetworkId: privateNetwork.id,
        deleteAdditionalResources: false,
    },
    { provider: provider }
);

// Create a nodepool for the cluster
const nodePool = new scaleway.kubernetes.Pool(
    "node-pool",
    {
        clusterId: cluster.id,
        name: prefix + "-pool",
        nodeType: nodeSize,
        size: nodeCount,
    },
    { provider: provider }
);

// Get the kubeconfig for the cluster.  This has to depend on the node pool
// being setup
const kubeconfig = pulumi.all([
    cluster.kubeconfigs, nodePool.id
]).apply(
    ([kconf, node]) => kconf[0].configFile
);

// Create a Kubernetes provider using the cluster's kubeconfig
const k8sProvider = new k8s.Provider(
    "k8sProvider",
    {
        kubeconfig: kubeconfig,
    }
);

// Create an IAM application
const application = new scaleway.iam.Application(
    "application",
    {
        name: "TrustGraph"
    },
    { provider: provider, dependsOn: [ nodePool ] }
);

// Grant the application access to gen AI models
const policy = new scaleway.iam.Policy(
    "policy",
    {
        name: "Generative AI access policy",
        description: "Gives app model access",
        applicationId: application.id,
        rules: [{
            projectIds: [ project.id ],
            permissionSetNames: [ "GenerativeApisModelAccess" ],
        }],
    },
    { provider: provider }
);

// Generate an API key
const apiKey = new scaleway.iam.ApiKey(
    "api-key",
    {
        applicationId: application.id,
        description: "TrustGraph AI key",
    },
    { provider: provider }
);

// Write the kubeconfig to a file
kubeconfig.apply(
    (key : string) => {
        fs.writeFile(
            "kube.cfg",
            key,
            err => {
                if (err) {
                    console.log(err);
                    throw(err);
                } else {
                    console.log("Wrote kube.cfg.");
                }
            }
        );
    }
);

// Get application resource definitions
const resourceDefs = fs.readFileSync("../resources.yaml", {encoding: "utf-8"});

// Deploy resources to the K8s cluster
const appDeploy = new k8s.yaml.v2.ConfigGroup(
    "resources",
    {
        yaml: resourceDefs,
        skipAwait: true,
    },
    { provider: k8sProvider }
);

// Generate an (empty) gateway secret - no authentication
const gatewaySecret = new k8s.core.v1.Secret(
    "gateway-secret",
    {
        metadata: {
            name: "gateway-secret",
            namespace: "trustgraph"
        },
        stringData: {
            "gateway-secret": ""
        },
    },
    { provider: k8sProvider, dependsOn: appDeploy }
);

// Generate an (empty) MCP server secret - no authentication
const mcpServerSecret = new k8s.core.v1.Secret(
    "mcp-server-secret",
    {
        metadata: {
            name: "mcp-server-secret",
            namespace: "trustgraph"
        },
        stringData: {
            "mcp-server-secret": ""
        },
    },
    { provider: k8sProvider, dependsOn: appDeploy }
);

// Generate an AI endpoint secret - URL plus secret token
const endpointSecret = new k8s.core.v1.Secret(
    "ai-secret",
    {
        metadata: {
            name: "openai-credentials",
            namespace: "trustgraph"
        },
        stringData: {
            "openai-token": apiKey.secretKey,
            "openai-url": aiUrl,
        },
    },
    { provider: k8sProvider, dependsOn: appDeploy }
);

