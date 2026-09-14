import { InvokeCommand } from "@aws-sdk/client-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SHARED_CLAIMS } from "../../../utils/src/constants";
import { invokeStartFunction, StartFunctionError } from "../src/client/start-function";
import { configureEnvironment, START_FUNCTION_NAME } from "./helpers/app";
import {
    START_FUNCTION_RESPONSE,
    startFunctionInvocations,
    startFunctionMock,
    startFunctionResponds,
    startFunctionSucceeds,
} from "./helpers/start-function";

describe("invokeStartFunction", () => {
    beforeEach(() => {
        startFunctionMock.reset();
        configureEnvironment();
    });

    it("sends the client id with the default shared claims and returns the client id and request", async () => {
        startFunctionSucceeds();

        await expect(invokeStartFunction("a-client-id")).resolves.toEqual(START_FUNCTION_RESPONSE);
        expect(startFunctionInvocations()).toEqual([
            {
                functionName: START_FUNCTION_NAME,
                overrides: { client_id: "a-client-id", shared_claims: DEFAULT_SHARED_CLAIMS },
            },
        ]);
    });

    it("propagates the start function's error message", async () => {
        startFunctionResponds(400, { message: "Claims set failed validation" });

        await expect(invokeStartFunction("a-client-id")).rejects.toThrow(/400: Claims set failed validation/);
    });

    it("rejects when the start function errors", async () => {
        startFunctionMock.on(InvokeCommand).resolves({ FunctionError: "Unhandled" });

        await expect(invokeStartFunction("a-client-id")).rejects.toThrow(StartFunctionError);
    });

    it("rejects when the lambda api cannot be reached", async () => {
        startFunctionMock.on(InvokeCommand).rejects(new Error("connect ETIMEDOUT 10.0.0.1:443"));

        await expect(invokeStartFunction("a-client-id")).rejects.toThrow(/Could not reach function/);
    });

    it("rejects an incomplete response", async () => {
        startFunctionResponds(200, { client_id: "only-the-client-id" });

        await expect(invokeStartFunction("a-client-id")).rejects.toThrow(/did not return a client_id and request/);
    });

    it("rejects when the function name is not configured", async () => {
        vi.stubEnv("START_FUNCTION_NAME", undefined);

        await expect(invokeStartFunction("a-client-id")).rejects.toThrow(/START_FUNCTION_NAME is not configured/);
    });
});
