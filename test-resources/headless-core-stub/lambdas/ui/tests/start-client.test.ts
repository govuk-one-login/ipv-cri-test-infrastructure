import { InvokeCommand, type InvokeCommandOutput, LambdaClient } from "@aws-sdk/client-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { buildClaimsSetOverrides, startJourney, StartFunctionError } from "../src/client/start-client";

const lambdaMock = mockClient(LambdaClient);

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)) as InvokeCommandOutput["Payload"];

describe("buildClaimsSetOverrides", () => {
    it("passes the client id through", () => {
        const claimSet = buildClaimsSetOverrides({ clientId: "a-client-id" });
        expect(claimSet.client_id).toBe("a-client-id");
        expect(claimSet.shared_claims.name).toEqual([
            {
                nameParts: [
                    { type: "GivenName", value: "KENNETH" },
                    { type: "FamilyName", value: "DECERQUEIRA" },
                ],
            },
        ]);
        expect(claimSet.shared_claims.birthDate).toEqual([{ value: "1965-07-08" }]);
        expect(claimSet.shared_claims.address).toHaveLength(1);
    });
});

const overrides = buildClaimsSetOverrides({ clientId: "ipv-core-stub-aws-headless" });

describe("startJourney", () => {
    beforeEach(() => {
        lambdaMock.reset();
        process.env.START_FUNCTION_NAME = "test-resources-StartFunction:live";
    });

    it("invokes the start function and returns the client id and request", async () => {
        lambdaMock.on(InvokeCommand).resolves({
            StatusCode: 200,
            Payload: encode({
                statusCode: 200,
                body: JSON.stringify({ client_id: "ipv-core-stub-aws-headless", request: "encrypted.jwt" }),
            }),
        });

        await expect(startJourney(overrides)).resolves.toEqual({
            client_id: "ipv-core-stub-aws-headless",
            request: "encrypted.jwt",
        });

        const call = lambdaMock.commandCalls(InvokeCommand)[0].args[0].input;
        expect(call.FunctionName).toBe("test-resources-StartFunction:live");
        expect(JSON.parse(call.Payload as string)).toEqual({ body: JSON.stringify(overrides) });
    });

    it("propagates stub error message", async () => {
        lambdaMock.on(InvokeCommand).resolves({
            Payload: encode({ statusCode: 400, body: JSON.stringify({ message: "Claims set failed validation" }) }),
        });

        await expect(startJourney(overrides)).rejects.toThrow(/400: Claims set failed validation/);
    });

    it("rejects when the start function errors", async () => {
        lambdaMock.on(InvokeCommand).resolves({ FunctionError: "Unhandled", Payload: encode({}) });

        await expect(startJourney(overrides)).rejects.toThrow(StartFunctionError);
    });

    it("rejects an incomplete response", async () => {
        lambdaMock.on(InvokeCommand).resolves({
            Payload: encode({ statusCode: 200, body: JSON.stringify({ client_id: "only-the-client-id" }) }),
        });

        await expect(startJourney(overrides)).rejects.toThrow(/did not return a client_id and request/);
    });

    it("rejects when the function name is not configured", async () => {
        delete process.env.START_FUNCTION_NAME;

        await expect(startJourney(overrides)).rejects.toThrow(/START_FUNCTION_NAME is not configured/);
    });
});
