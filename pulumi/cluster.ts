
import * as scaleway from '@pulumiverse/scaleway';
import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import * as fs from 'fs';

import { prefix, region, nodeSize, nodeCount } from './config';

// Scaleway provider, allows setting the default region
export const provider = new scaleway.Provider(
    "scaleway-provider",
    {
        region: region
    }
);

// Get project information
export const project = scaleway.account.getProjectOutput(
    {},
    { provider: provider }
);

// If you know the project ID, you can work out the Generative AI endpoint
// URL
export const aiUrl = project.id.apply(
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
        version: "1.35.3",
        cni: "cilium",
        privateNetworkId: privateNetwork.id,
        deleteAdditionalResources: false,
    },
    { provider: provider }
);

// Create a nodepool for the cluster
export const nodePool = new scaleway.kubernetes.Pool(
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
export const k8sProvider = new k8s.Provider(
    "k8sProvider",
    {
        kubeconfig: kubeconfig,
    }
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
