import { Logger } from "@aws-lambda-powertools/logger";
import { getOptionalParameterValue, getParametersValues } from "../parameter/get-parameters";
import { DEFAULT_CLIENT_ID } from "../constants";
import { HeadlessCoreStubError } from "../errors/headless-core-stub-error";
import config from "./config";
const { commonStackName } = config;

const signingKeyPath = (clientId: string) => `/test-resources/${clientId}/privateSigningKey`;

export type ClientConfig = {
    audience: string;
    issuer: string;
    redirectUri: string;
    privateSigningKey: string;
};

export class ClientConfiguration {
    public static async getConfig(clientId: string, logger?: Logger): Promise<ClientConfig> {
        const parameters = [
            `/${commonStackName}/clients/${clientId}/jwtAuthentication/audience`,
            `/${commonStackName}/clients/${clientId}/jwtAuthentication/issuer`,
            `/${commonStackName}/clients/${clientId}/jwtAuthentication/redirectUri`,
        ];

        const { audience, issuer, redirectUri } = await getParametersValues(parameters);

        return {
            audience,
            issuer,
            redirectUri,
            privateSigningKey: await getPrivateSigningKey(clientId, logger),
        };
    }
}

const getPrivateSigningKey = async (clientId: string, logger?: Logger): Promise<string> => {
    if (clientId !== DEFAULT_CLIENT_ID) {
        const clientKey = await getOptionalParameterValue(signingKeyPath(clientId));
        if (clientKey) {
            return clientKey;
        }

        logger?.warn({
            message: `No private signing key found for id: ${clientId}, falling back to ${DEFAULT_CLIENT_ID}`,
            attemptedPath: signingKeyPath(clientId),
            fallbackPath: signingKeyPath(DEFAULT_CLIENT_ID),
            clientId,
        });
    }

    const defaultKey = await getOptionalParameterValue(signingKeyPath(DEFAULT_CLIENT_ID));
    if (!defaultKey) {
        throw new HeadlessCoreStubError(`No private signing key at ${signingKeyPath(DEFAULT_CLIENT_ID)}`, 500);
    }

    return defaultKey;
};
