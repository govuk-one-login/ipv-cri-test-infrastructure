import { InvokeCommand, type InvokeCommandOutput, LambdaClient } from "@aws-sdk/client-lambda";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { lambdaHandler } from "../src/handler/ui-handler";
import { configureEnvironment, CREDENTIALS } from "./helpers/app";

const lambdaMock = mockClient(LambdaClient);

const HOST = "blah.execute-api.eu-west-2.amazonaws.com";

const proxyEvent = (path: string, body: string): APIGatewayProxyEvent =>
    ({
        httpMethod: "POST",
        path: `/ui/${path}`,
        resource: "/ui/{proxy+}",
        multiValueHeaders: {
            host: [HOST],
            "content-type": ["application/x-www-form-urlencoded"],
            "x-forwarded-proto": ["https"],
        },
        body,
        isBase64Encoded: false,
        requestContext: { stage: "dev", path: `/dev/ui/${path}`, identity: { sourceIp: "1.2.3.4" } },
    }) as unknown as APIGatewayProxyEvent;

const invoke = (event: APIGatewayProxyEvent) => lambdaHandler(event, {} as Context, () => {});

const signIn = () => invoke(proxyEvent("sign-in", `username=${CREDENTIALS.username}&password=${CREDENTIALS.password}`));

const sessionCookie = (response: { multiValueHeaders: Record<string, string[]> }) =>
    response.multiValueHeaders["set-cookie"][0].split(";")[0];

beforeEach(() => {
    lambdaMock.reset();
    configureEnvironment();
    lambdaMock.on(InvokeCommand).resolves({
        Payload: new TextEncoder().encode(
            JSON.stringify({
                statusCode: 200,
                body: JSON.stringify({ client_id: "ipv-core-stub-aws-headless", request: "encrypted.jwt" }),
            }),
        ) as InvokeCommandOutput["Payload"],
    });
});

describe("lambdaHandler", () => {
    it("parses a form body", async () => {
        const response = await signIn();

        expect(response.statusCode).toBe(302);
        expect(response.multiValueHeaders.location).toEqual(["/dev/ui"]);
    });

    it("parses a form body on a route behind requireSession", async () => {
        const event = proxyEvent("start", "client_id=some-client&authorise_base_url=http://localhost:4501");
        event.multiValueHeaders.cookie = [sessionCookie(await signIn())];

        const response = await invoke(event);

        expect(response.statusCode).toBe(302);
        expect(response.multiValueHeaders.location[0]).toMatch(/^http:\/\/localhost:4501\/oauth2\/authorize\?/);
    });
});
