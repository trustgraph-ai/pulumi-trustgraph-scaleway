
// Configuration stuff, largely loading stuff from the configuration file

import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config();

// Get 'environment', should be something like live, dev, ref etc.
export const environment = cfg.require("environment");

// Get 'region', should be something like fr-par, pl-waw
export const region = cfg.require("region");

// Default tags
export const tags : { [key : string] : string } = {
};

export const tagsSep = Object.entries(tags).map(
    (x : string[]) => (x[0] + "=" + x[1])
).join(",");

// Make up a cluster name
export const prefix = "trustgraph-" + environment;

// TrustGraph version
export const nodeSize = "DEV1-L";
export const nodeCount = 3;
