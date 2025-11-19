import * as pulumi from "@pulumi/pulumi";

pulumi.runtime.setMocks({
    newResource: function(args: pulumi.runtime.MockResourceArgs): {id: string, state: any} {
        return {
            id: args.inputs.name + "_id",
            state: args.inputs,
        };
    },
    call: function(args: pulumi.runtime.MockCallArgs) {
        return args.inputs;
    },
});

describe("Configuration Loading", () => {
    beforeEach(() => {
        pulumi.runtime.setAllConfig({
            "project:environment": "test",
            "project:region": "fr-par",
        });
    });

    afterEach(() => {
        jest.resetModules();
    });

    test("should load required configuration values", async () => {
        const config = await import("../config");

        expect(config.environment).toBe("test");
        expect(config.region).toBe("fr-par");
    });

    test("should generate correct prefix based on environment", async () => {
        const config = await import("../config");
        
        expect(config.prefix).toBe("trustgraph-test");
    });

    test("should have correct node configuration", async () => {
        const config = await import("../config");

        expect(config.nodeSize).toBe("DEV1-L");
        expect(config.nodeCount).toBe(3);
    });

    test("should handle missing environment configuration", async () => {
        pulumi.runtime.setAllConfig({
            "project:region": "fr-par",
        });

        await expect(import("../config")).rejects.toThrow();
    });

    test("should handle missing region configuration", async () => {
        pulumi.runtime.setAllConfig({
            "project:environment": "test",
        });

        await expect(import("../config")).rejects.toThrow();
    });

    test("should generate correct tags separator string", async () => {
        const config = await import("../config");
        
        expect(config.tagsSep).toBe("");
    });
});