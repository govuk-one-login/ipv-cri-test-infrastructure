import request from "supertest";
import { createApp } from "../../src/app";
import { SIGN_IN_PATH } from "../../src/paths";

export const CRI_FRONTEND_URL = "https://review-ob.dev.account.gov.uk";
export const CREDENTIALS = { username: "smcduck", password: "hunter2" }; // pragma: allowlist secret

export const configureEnvironment = (): void => {
    process.env.UI_SESSION_KEY = Buffer.alloc(32, "k").toString("base64");
    process.env.UI_CREDENTIALS = `${CREDENTIALS.username}:${CREDENTIALS.password}`;
    process.env.CRI_FRONTEND_URL = CRI_FRONTEND_URL;
    process.env.START_FUNCTION_NAME = "test-resources-StartFunction:live";
};

export const signedInAgent = async () => {
    const agent = request.agent(createApp());

    await agent.post(SIGN_IN_PATH).type("form").send(CREDENTIALS).expect(302);

    return agent;
};
