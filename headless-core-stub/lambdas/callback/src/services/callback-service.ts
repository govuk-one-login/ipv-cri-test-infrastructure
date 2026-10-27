import { APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { APIGatewayClient, GetApiKeyCommand } from "@aws-sdk/client-api-gateway";

const apiGatewayClient = new APIGatewayClient();

export class CallBackService {
    private cachedApiKeyValue: string | undefined;

    constructor(private readonly logger: Logger) {}

    public async invokeTokenEndpoint(tokenEndpoint: string, body: string): Promise<APIGatewayProxyResult> {
        this.logger.info("Invoking token endpoint");
        const tokenResponse = await fetch(tokenEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                "x-api-key": await this.fetchApiKeyValue(),
            },
            body: body,
        });

        const status = tokenResponse.status;
        const tokenResponseBodyText = await tokenResponse.text();

        if (!tokenResponse.ok) {
            this.logger.error({
                message: "Request to token endpoint failed",
                tokenEndpoint,
                status,
                responseBody: tokenResponseBodyText,
                headers: Object.fromEntries(tokenResponse.headers.entries()),
            });
            throw new Error(`Failed with ${status} status: ${tokenResponseBodyText}`);
        }
        return { statusCode: status, body: tokenResponseBodyText };
    }

    public async invokeCredentialEndpoint(
        credentialEndpoint: string,
        accessToken: string,
    ): Promise<APIGatewayProxyResult> {
        const credentialResponse = await fetch(credentialEndpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "x-api-key": await this.fetchApiKeyValue(),
            },
        });
        const status = credentialResponse.status;
        const responseBody = await credentialResponse.text();

        if (!credentialResponse.ok) {
            this.logger.error({
                message: "Request to credential endpoint failed",
                credentialEndpoint,
                status,
                responseBody,
            });
            return { statusCode: status, body: responseBody };
        }

        this.logger.info({ message: "Successfully called /credential/issue endpoint" });
        return { statusCode: status, body: responseBody };
    }

    public async fetchApiKeyValue() {
        if (this.cachedApiKeyValue) {
            this.logger.info("Returning cached API Key");
            return this.cachedApiKeyValue;
        }

        const apiKeyId = process.env.API_KEY;
        if (!apiKeyId) {
            this.logger.warn("API_KEY environment variable is not set");
            return "";
        }

        const response = await apiGatewayClient.send(new GetApiKeyCommand({ apiKey: apiKeyId, includeValue: true }));
        if (!response.value) {
            this.logger.warn({ message: "GetApiKeyCommand returned no value", apiKeyId });
            return "";
        }
        this.cachedApiKeyValue = response.value;
        this.logger.info({
            message: "API key fetched",
            lastFour: response.value.slice(-4),
            length: response.value.length,
        });
        return this.cachedApiKeyValue;
    }
}
