import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { DEFAULT_SHARED_CLAIMS } from "../../../../utils/src/constants";

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || "eu-west-2" });

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

    const result = await lambdaClient.send(
        new InvokeCommand({
            FunctionName: functionName,
            Payload: JSON.stringify({ body: JSON.stringify(overrides) }),
        }),
    );

    if (result.FunctionError) {
        throw new StartFunctionError(`Headless core stub failed: ${result.FunctionError}`);
    }

    const payload = result.Payload ? new TextDecoder().decode(result.Payload) : "";

    let response: { statusCode?: number; body?: string };
    try {
        response = JSON.parse(payload);
    } catch {
        throw new StartFunctionError("Headless core stub returned a response that could not be parsed");
    }

    if (response.statusCode !== 200) {
        throw new StartFunctionError(
            `Headless core stub returned ${response.statusCode}: ${extractMessage(response.body)}`,
        );
    }

    const { client_id, request } = JSON.parse(response.body as string) as Partial<StartResponse>;
    if (!client_id || !request) {
        throw new StartFunctionError("Headless core stub did not return a client_id and request");
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
