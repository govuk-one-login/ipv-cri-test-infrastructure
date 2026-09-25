import { Logger } from "@aws-lambda-powertools/logger";
import { ClientConfiguration } from "../../src/services/client-configuration";
import { getOptionalParameterValue, getParametersValues } from "../../src/parameter/get-parameters";
import { DEFAULT_CLIENT_ID } from "../../src/constants";
import { vi, describe, expect, it, beforeEach } from "vitest";

vi.mock("../../src/parameter/get-parameters", () => ({
    getParametersValues: vi.fn(),
    getOptionalParameterValue: vi.fn(),
}));

const mockGetParamatersValues = vi.mocked(getParametersValues);
const mockGetOptionalParameterValue = vi.mocked(getOptionalParameterValue);

const commonStackName = "mock-common-prefix";
const issuer = "mock-issuer";
const audience = "my-audience";
const redirectUri = "https://test-resources.headless-core-stub.redirect/callback";
const overrideClientId = "ipv-core-stub-aws-build_3rdparty";

const signingKeyPath = (clientId: string) => `/test-resources/${clientId}/privateSigningKey`;

const jwtAuthenticationPaths = (clientId: string) => [
    `/${commonStackName}/clients/${clientId}/jwtAuthentication/audience`,
    `/${commonStackName}/clients/${clientId}/jwtAuthentication/issuer`,
    `/${commonStackName}/clients/${clientId}/jwtAuthentication/redirectUri`,
];

describe("getConfig", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetParamatersValues.mockResolvedValue({ audience, issuer, redirectUri });
    });

    it("returns expected values when properly configured", async () => {
        mockGetOptionalParameterValue.mockResolvedValueOnce("default-key");

        const result = await ClientConfiguration.getConfig(DEFAULT_CLIENT_ID);

        expect(mockGetParamatersValues).toHaveBeenCalledWith(jwtAuthenticationPaths(DEFAULT_CLIENT_ID));
        expect(result).toEqual({
            audience,
            redirectUri,
            issuer,
            privateSigningKey: "default-key",
        });
    });

    it("reads only the default key for the default client", async () => {
        mockGetOptionalParameterValue.mockResolvedValueOnce("default-key");

        await ClientConfiguration.getConfig(DEFAULT_CLIENT_ID);

        expect(mockGetOptionalParameterValue).toHaveBeenCalledOnce();
        expect(mockGetOptionalParameterValue).toHaveBeenCalledWith(signingKeyPath(DEFAULT_CLIENT_ID));
    });

    it("prefers client-specific key when one is readable", async () => {
        mockGetOptionalParameterValue.mockResolvedValueOnce("override-key");

        const result = await ClientConfiguration.getConfig(overrideClientId);

        expect(mockGetOptionalParameterValue).toHaveBeenCalledOnce();
        expect(mockGetOptionalParameterValue).toHaveBeenCalledWith(signingKeyPath(overrideClientId));
        expect(result.privateSigningKey).toEqual("override-key");
    });

    it("falls back to default key when no client-specific key is readable", async () => {
        mockGetOptionalParameterValue.mockResolvedValueOnce(undefined).mockResolvedValueOnce("default-key");

        const result = await ClientConfiguration.getConfig(overrideClientId);

        expect(mockGetOptionalParameterValue).toHaveBeenNthCalledWith(1, signingKeyPath(overrideClientId));
        expect(mockGetOptionalParameterValue).toHaveBeenNthCalledWith(2, signingKeyPath(DEFAULT_CLIENT_ID));
        expect(result.privateSigningKey).toEqual("default-key");
    });

    it("warns when falling back to the default key", async () => {
        mockGetOptionalParameterValue.mockResolvedValueOnce(undefined).mockResolvedValueOnce("default-key");
        const logger = new Logger();
        const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

        await ClientConfiguration.getConfig(overrideClientId, logger);

        expect(warnSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                attemptedPath: signingKeyPath(overrideClientId),
                fallbackPath: signingKeyPath(DEFAULT_CLIENT_ID),
                clientId: overrideClientId,
            }),
        );
    });

    it("throws when no default key is readable", async () => {
        mockGetOptionalParameterValue.mockResolvedValue(undefined);

        await expect(ClientConfiguration.getConfig(overrideClientId)).rejects.toThrow(
            `No private signing key at ${signingKeyPath(DEFAULT_CLIENT_ID)}`,
        );
    });
});
