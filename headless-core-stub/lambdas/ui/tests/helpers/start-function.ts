import { InvokeCommand, type InvokeCommandOutput, LambdaClient } from "@aws-sdk/client-lambda";
import { mockClient } from "aws-sdk-client-mock";

export const startFunctionMock = mockClient(LambdaClient);

export const START_FUNCTION_RESPONSE = { client_id: "ipv-core-stub-aws-headless", request: "encrypted.jwt" };

export const startFunctionResponds = (statusCode: number, body: object) =>
    startFunctionMock.on(InvokeCommand).resolves({
        Payload: new TextEncoder().encode(
            JSON.stringify({ statusCode, body: JSON.stringify(body) }),
        ) as InvokeCommandOutput["Payload"],
    });

export const startFunctionSucceeds = () => startFunctionResponds(200, START_FUNCTION_RESPONSE);

export const startFunctionInvocations = () =>
    startFunctionMock.commandCalls(InvokeCommand).map((call) => {
        const [command] = call.args;
        const { FunctionName, Payload } = command.input;
        const event = JSON.parse(Payload as string);

        return { functionName: FunctionName, overrides: JSON.parse(event.body) };
    });
