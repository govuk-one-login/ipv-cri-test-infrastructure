import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { SIGN_IN_PATH, UI_ROOT } from "../../src/paths";
import { configureEnvironment, CREDENTIALS, signedInAgent } from "../helpers/app";

const signIn = (credentials: Record<string, string>) =>
    request(createApp()).post(SIGN_IN_PATH).type("form").send(credentials);

beforeEach(configureEnvironment);

describe("GET /ui/sign-in", () => {
    it("renders the sign in page", async () => {
        const response = await request(createApp()).get(SIGN_IN_PATH);

        expect(response.status).toBe(200);
        expect(response.text).toContain('action="/ui/sign-in"');
        expect(response.text).toContain('id="password" name="password" type="password"');
    });
});

describe("POST /ui/sign-in", () => {
    it("sets a session cookie on success", async () => {
        const response = await signIn(CREDENTIALS);

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(UI_ROOT);
        expect(response.headers["set-cookie"][0]).toMatch(/^ui_session=.+HttpOnly/s);
    });

    it("rejects a wrong password without setting a session cookie", async () => {
        const response = await signIn({ ...CREDENTIALS, password: "wrong" }); // pragma: allowlist secret

        expect(response.status).toBe(401);
        expect(response.text).toContain("Incorrect username or password");
        expect(response.headers["set-cookie"]).toBeUndefined();
    });

    it("rejects a wrong password of the same length", async () => {
        const response = await signIn({ ...CREDENTIALS, password: "hunter3" }); // pragma: allowlist secret

        expect(response.status).toBe(401);
        expect(response.headers["set-cookie"]).toBeUndefined();
    });

    it("errors when no session key is configured", async () => {
        delete process.env.UI_SESSION_KEY;
        delete process.env.SESSION_KEY_PARAM_NAME;

        const response = await signIn(CREDENTIALS);

        expect(response.status).toBe(503);
    });

    it("errors when no credentials are configured", async () => {
        delete process.env.UI_CREDENTIALS;
        delete process.env.CREDENTIALS_PARAM_NAME;

        const response = await signIn(CREDENTIALS);

        expect(response.status).toBe(503);
    });
});

describe("session", () => {
    it("redirects to sign in when no session is present", async () => {
        const response = await request(createApp()).get(UI_ROOT);

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(SIGN_IN_PATH);
    });

    it("rejects a session cookie encrypted with a different key", async () => {
        const agent = await signedInAgent();
        process.env.UI_SESSION_KEY = Buffer.alloc(32, "a").toString("base64");

        const response = await agent.get(UI_ROOT);

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(SIGN_IN_PATH);
    });
});
