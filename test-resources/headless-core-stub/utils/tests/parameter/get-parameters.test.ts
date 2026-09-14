import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import * as GetParameters from "../../src/parameter/get-parameters";
import { vi, describe, expect, it, beforeEach } from "vitest";

vi.mock("@aws-lambda-powertools/parameters/ssm", () => ({
    getParametersByName: vi.fn(),
}));

const mockGetParametersByName = vi.mocked(getParametersByName);
const issuer = "mock-issuer";
const audience = "my-audience";

describe("getParametersValues", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("returns parameter values when getParametersByName resolves successfully", async () => {
        const mockParameterPaths = [
            "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/audience",
            "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/issuer",
        ];

        const mockParameters = {
            "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/audience": audience,
            "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/issuer": issuer,
        };

        mockGetParametersByName.mockResolvedValueOnce({
            ...mockParameters,
            _errors: [],
        });

        const result = await GetParameters.getParametersValues(mockParameterPaths);
        expect(mockGetParametersByName).toHaveBeenCalledWith(
            Object.fromEntries(mockParameterPaths.map((path) => [path, {}])),
            { maxAge: 300, throwOnError: false },
        );
        expect(result).toEqual({
            audience,
            issuer: "mock-issuer",
        });
    });

    it("throws an error when getParametersByName returns errors", async () => {
        const mockParameterPaths = [
            "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/audience",
            "/mock-common-prefix/clients/mock-client-id/jwtAuthentication/issuer",
        ];

        mockGetParametersByName.mockResolvedValueOnce({
            _errors: ["/mock-common-prefix/clients/mock-client-id/jwtAuthentication/audience"],
        });

        await expect(GetParameters.getParametersValues(mockParameterPaths)).rejects.toThrowError(
            "Following SSM parameters do not exist: /mock-common-prefix/clients/mock-client-id/jwtAuthentication/audience",
        );
    });
});

describe("getOptionalParameterValue", () => {
    const mockParameterPath = "/test-resources/mock-client-id/privateSigningKey";

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("returns the value when the parameter resolves successfully", async () => {
        mockGetParametersByName.mockResolvedValueOnce({
            [mockParameterPath]: "mock-key",
            _errors: [],
        });

        await expect(GetParameters.getOptionalParameterValue(mockParameterPath)).resolves.toEqual("mock-key");
        expect(mockGetParametersByName).toHaveBeenCalledWith(
            { [mockParameterPath]: {} },
            { maxAge: 300, throwOnError: false },
        );
    });

    it("returns undefined when the parameter does not exist", async () => {
        mockGetParametersByName.mockResolvedValueOnce({ _errors: [mockParameterPath] });

        await expect(GetParameters.getOptionalParameterValue(mockParameterPath)).resolves.toBeUndefined();
    });

    it("returns undefined when the parameter cannot be read", async () => {
        mockGetParametersByName.mockRejectedValueOnce(new Error("AccessDeniedException"));

        await expect(GetParameters.getOptionalParameterValue(mockParameterPath)).resolves.toBeUndefined();
    });
});
