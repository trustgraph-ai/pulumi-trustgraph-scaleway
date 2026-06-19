
import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import * as random from '@pulumi/random';
import * as scaleway from '@pulumiverse/scaleway';

import { provider, project, aiUrl, nodePool, k8sProvider } from './cluster';
import { appDeploy } from './application';

import { gatewayIp } from './gateway';

const iamBootstrapToken = new random.RandomPassword(
    "iam-bootstrap-token",
    {
        length: 32,
        special: false,
    },
);

const grafanaAdminPassword = new random.RandomPassword(
    "grafana-admin-password",
    {
        length: 16,
        special: true,
        overrideSpecial: "!@#$%^&*",
    },
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

const iamSecret = new k8s.core.v1.Secret(
    "iam-bootstrap-token",
    {
        metadata: {
            name: "iam-bootstrap-token",
            namespace: "trustgraph"
        },
        stringData: {
            "token": pulumi.interpolate`tg_${iamBootstrapToken.result}`,
        },
    },
    { provider: k8sProvider, dependsOn: appDeploy }
);

const grafanaSecret = new k8s.core.v1.Secret(
    "grafana-secret",
    {
        metadata: {
            name: "grafana-secret",
            namespace: "trustgraph"
        },
        stringData: {
            "password": grafanaAdminPassword.result,
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

export const iamToken = pulumi.interpolate`tg_${iamBootstrapToken.result}`;

export const grafanaPassword = grafanaAdminPassword.result;

export { gatewayIp };
