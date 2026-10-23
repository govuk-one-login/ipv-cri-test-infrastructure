import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CLIENT_ID } from "../../../../utils/src/constants";
import { createApp } from "../../src/app";
import { validateForm } from "../../src/controllers/start.controller";
import { START_PATH, UI_ROOT } from "../../src/paths";
import { configureEnvironment, CRI_FRONTEND_URL } from "../helpers/app";
import {
    START_FUNCTION_RESPONSE,
    startFunctionInvocations,
    startFunctionMock,
    startFunctionResponds,
    startFunctionSucceeds,
} from "../helpers/start-function";

const validForm = {
    client_id: DEFAULT_CLIENT_ID,
    authorise_base_url: CRI_FRONTEND_URL,
};

beforeEach(() => {
    startFunctionMock.reset();
    configureEnvironment();
});

const submitForm = (form: Record<string, string>) => request(createApp()).post(START_PATH).type("form").send(form);

describe("validateForm", () => {
    it("accepts the deployed CRI front end", () => {
        expect(validateForm(validForm)).toEqual({
            values: { clientId: DEFAULT_CLIENT_ID, authoriseBaseUrl: CRI_FRONTEND_URL },
            authoriseBase: new URL(CRI_FRONTEND_URL),
        });
    });

    it("accepts a localhost front end", () => {
        expect(validateForm({ ...validForm, authorise_base_url: "http://localhost:4501" })).toMatchObject({
            authoriseBase: new URL("http://localhost:4501"),
        });
    });

    it("requires a client id", () => {
        expect(validateForm({ ...validForm, client_id: "  " })).toMatchObject({
            values: { clientId: "" },
            errors: { clientId: "Enter an OAuth Client ID" },
        });
    });

    it("requires a front end url", () => {
        expect(validateForm({ ...validForm, authorise_base_url: "" })).toMatchObject({
            errors: { authoriseBaseUrl: "Enter the CRI front URL" },
        });
    });
});

describe("GET /ui", () => {
    it("renders the form with defaults", async () => {
        const response = await request(createApp()).get(UI_ROOT);

        expect(response.status).toBe(200);
        expect(response.text).toMatch(/<title>Start a journey - .+<\/title>/);
        expect(response.text).toContain('id="client_id"');
        expect(response.text).toContain(`value="${DEFAULT_CLIENT_ID}"`);
        expect(response.text).toContain('value="KENNETH"');
        expect(response.text).toContain('value="DECERQUEIRA"');
        expect(response.text).toContain(`value="${CRI_FRONTEND_URL}"`);
        expect(response.text).not.toContain("govuk-error-summary");
    });
});

describe("POST /ui/start", () => {
    it("creates a JWT and redirects to the authorise endpoint", async () => {
        startFunctionSucceeds();

        const response = await submitForm(validForm);

        expect(response.status).toBe(302);
        const location = new URL(response.headers.location);
        expect(location.origin).toBe(CRI_FRONTEND_URL);
        expect(location.pathname).toBe("/oauth2/authorize");
        expect(location.searchParams.get("client_id")).toBe(START_FUNCTION_RESPONSE.client_id);
        expect(location.searchParams.get("request")).toBe(START_FUNCTION_RESPONSE.request);
    });

    it("redirects to a local front end", async () => {
        startFunctionSucceeds();

        const response = await submitForm({ ...validForm, authorise_base_url: "http://localhost:4501" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toMatch(/^http:\/\/localhost:4501\/oauth2\/authorize\?/);
    });

    it("passes a custom client id to the stub", async () => {
        startFunctionSucceeds();

        await submitForm({ ...validForm, client_id: "some-other-client" });

        const [invocation] = startFunctionInvocations();
        expect(invocation.overrides.client_id).toBe("some-other-client");
    });

    it("rejects an invalid redirect host without calling the stub", async () => {
        const response = await submitForm({ ...validForm, authorise_base_url: "https://evil.example.com" });

        expect(response.status).toBe(400);
        expect(response.text).toContain("There is a problem");
        expect(response.text).toContain(`Enter either ${CRI_FRONTEND_URL} or a localhost address`);
        expect(startFunctionInvocations()).toHaveLength(0);
    });

    it("renders field errors", async () => {
        const response = await submitForm({ ...validForm, client_id: "  " });

        expect(response.status).toBe(400);
        expect(response.text).toContain("Enter an OAuth Client ID");
        expect(startFunctionInvocations()).toHaveLength(0);
    });

    it("renders stub failures", async () => {
        startFunctionResponds(400, { message: "Claims set failed validation" });

        const response = await submitForm(validForm);

        expect(response.status).toBe(502);
        expect(response.text).toContain("Claims set failed validation");
    });

    it("escapes user input", async () => {
        const response = await submitForm({
            ...validForm,
            client_id: '"><script>alert(1)</script>',
            authorise_base_url: "https://evil.example.com",
        });

        expect(response.status).toBe(400);
        expect(response.text).not.toContain("<script>alert(1)</script>");
        expect(response.text).toContain("&quot;&gt;&lt;script&gt;");
    });
});
