import { vi } from "vitest";

export const CRI_FRONTEND_URL = "https://review-ob.dev.account.gov.uk";
export const START_FUNCTION_NAME = "test-resources-StartFunction:live";

export const configureEnvironment = (): void => {
    vi.stubEnv("CRI_FRONTEND_URL", CRI_FRONTEND_URL);
    vi.stubEnv("START_FUNCTION_NAME", START_FUNCTION_NAME);
};
