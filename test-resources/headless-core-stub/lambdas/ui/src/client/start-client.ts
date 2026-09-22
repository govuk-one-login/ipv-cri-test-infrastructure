import { InvokeCommand, InvokeCommandOutput, LambdaClient } from "@aws-sdk/client-lambda";
import { DEFAULT_SHARED_CLAIMS } from "../../../../utils/src/constants";
import { logger } from "../util/logger";

const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION,
    requestHandler: { connectionTimeout: 3_000, requestTimeout: 15_000 },
    maxAttempts: 2,
});

export type StartResponse = {
    client_id: string;
    request: string;
};

export class StartFunctionError extends Error {}

export const buildClaimsSetOverrides = ({ clientId }: { clientId: string }) => ({
    client_id: clientId,
    shared_claims: DEFAULT_SHARED_CLAIMS,
});

export const startJourney = async (overrides: ReturnType<typeof buildClaimsSetOverrides>): Promise<StartResponse> => {
    const functionName = process.env.START_FUNCTION_NAME;
    if (!functionName) {
        throw new StartFunctionError("START_FUNCTION_NAME is not configured");
    }

    logger.info("Invoking function", { functionName, clientId: overrides.client_id });
    const startedAt = Date.now();

    let result: InvokeCommandOutput;
    try {
        result = await lambdaClient.send(
            new InvokeCommand({
                FunctionName: functionName,
                Payload: JSON.stringify({ body: JSON.stringify(overrides) }),
            }),
        );
    } catch (error) {
        logger.error("Could not reach function", {
            functionName,
            durationMs: Date.now() - startedAt,
            error: error as Error,
        });
        throw new StartFunctionError(`Could not reach function: ${(error as Error).message}`);
    }

    logger.info("Got reply", {
        functionName,
        durationMs: Date.now() - startedAt,
        functionError: result.FunctionError,
    });

    if (result.FunctionError) {
        throw new StartFunctionError(`Function error: ${result.FunctionError}`);
    }

    const payload = result.Payload ? new TextDecoder().decode(result.Payload) : "";

    let response: { statusCode?: number; body?: string };
    try {
        response = JSON.parse(payload);
    } catch {
        throw new StartFunctionError("Function returned a response that could not be parsed");
    }

    if (response.statusCode !== 200) {
        throw new StartFunctionError(`Function returned ${response.statusCode}: ${extractMessage(response.body)}`);
    }

    const { client_id, request } = JSON.parse(response.body as string) as Partial<StartResponse>;
    if (!client_id || !request) {
        throw new StartFunctionError("Function did not return a client_id and request");
    }

    return { client_id, request };
};

const extractMessage = (body?: string): string => {
    if (!body) {
        return "no response body";
    }

    try {
        const parsed = JSON.parse(body);
        return parsed.message ?? body;
    } catch {
        return body;
    }
};
