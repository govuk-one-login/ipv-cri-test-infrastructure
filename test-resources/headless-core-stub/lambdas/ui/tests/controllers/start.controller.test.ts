import { InvokeCommand, type InvokeCommandOutput, LambdaClient } from "@aws-sdk/client-lambda";
import { mockClient } from "aws-sdk-client-mock";
import type request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { validateStartForm } from "../../src/controllers/start.controller";
import { START_PATH, UI_ROOT } from "../../src/paths";
import { configureEnvironment, CRI_FRONTEND_URL, signedInAgent } from "../helpers/app";

const lambdaMock = mockClient(LambdaClient);

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)) as InvokeCommandOutput["Payload"];

const resolveStart = () =>
    lambdaMock.on(InvokeCommand).resolves({
        Payload: encode({
            statusCode: 200,
            body: JSON.stringify({ client_id: "ipv-core-stub-aws-headless", request: "encrypted.jwt" }),
        }),
    });

const overridesSentToStub = () => {
    const payload = JSON.parse(lambdaMock.commandCalls(InvokeCommand)[0].args[0].input.Payload as string);

    return JSON.parse(payload.body);
};

const validForm = {
    client_id: "ipv-core-stub-aws-headless",
    authorise_base_url: CRI_FRONTEND_URL,
};

let agent: ReturnType<typeof request.agent>;

beforeEach(async () => {
    lambdaMock.reset();
    configureEnvironment();
    agent = await signedInAgent();
});

const submitForm = (form: Record<string, string>) => agent.post(START_PATH).type("form").send(form);

describe("validateStartForm", () => {
    it("accepts the deployed CRI front end", () => {
        const { errors, authoriseBase } = validateStartForm(validForm);

        expect(errors).toEqual({});
        expect(authoriseBase?.origin).toBe(CRI_FRONTEND_URL);
    });

    it("accepts a localhost front end", () => {
        const form = { ...validForm, authorise_base_url: "http://localhost:4501" };

        const { errors, authoriseBase } = validateStartForm(form);

        expect(errors).toEqual({});
        expect(authoriseBase?.origin).toBe("http://localhost:4501");
    });

    it("rejects any other host", () => {
        const form = { ...validForm, authorise_base_url: "https://evil.example.com" };

        const { errors, authoriseBase } = validateStartForm(form);

        expect(errors.authoriseBaseUrl).toBe(`Enter either ${CRI_FRONTEND_URL} or a localhost address`);
        expect(authoriseBase).toBeUndefined();
    });

    it("requires a client id", () => {
        const { values, errors } = validateStartForm({ ...validForm, client_id: "  " });

        expect(values.clientId).toBe("");
        expect(errors.clientId).toBe("Enter an OAuth Client ID");
    });

    it("requires a front end url", () => {
        const { errors } = validateStartForm({ ...validForm, authorise_base_url: "" });

        expect(errors.authoriseBaseUrl).toBe("Enter the CRI front URL");
    });
});

describe("GET /ui", () => {
    it("renders the form with defaults", async () => {
        const response = await agent.get(UI_ROOT);

        expect(response.status).toBe(200);
        expect(response.text).toMatch(/<title>Start a journey - .+<\/title>/);
        expect(response.text).toContain('id="client_id"');
        expect(response.text).toContain('value="ipv-core-stub-aws-headless"');
        expect(response.text).toContain('value="KENNETH"');
        expect(response.text).toContain('value="DECERQUEIRA"');
        expect(response.text).toContain(`value="${CRI_FRONTEND_URL}"`);
        expect(response.text).not.toContain("govuk-error-summary");
    });
});

describe("POST /ui/start", () => {
    it("creates a JWT and redirects to the authorise endpoint", async () => {
        resolveStart();

        const response = await submitForm(validForm);

        expect(response.status).toBe(302);
        const location = new URL(response.headers.location);
        expect(location.origin).toBe(CRI_FRONTEND_URL);
        expect(location.pathname).toBe("/oauth2/authorize");
        expect(location.searchParams.get("client_id")).toBe("ipv-core-stub-aws-headless");
        expect(location.searchParams.get("request")).toBe("encrypted.jwt");
    });

    it("sends the default shared claims to the stub", async () => {
        resolveStart();

        await submitForm(validForm);

        const overrides = overridesSentToStub();
        expect(overrides.shared_claims.name[0].nameParts).toEqual([
            { type: "GivenName", value: "KENNETH" },
            { type: "FamilyName", value: "DECERQUEIRA" },
        ]);
        expect(overrides.shared_claims.address).toHaveLength(1);
    });

    it("redirects to a local front end", async () => {
        resolveStart();

        const response = await submitForm({ ...validForm, authorise_base_url: "http://localhost:4501" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toMatch(/^http:\/\/localhost:4501\/oauth2\/authorize\?/);
    });

    it("passes a custom client id to the stub", async () => {
        resolveStart();

        await submitForm({ ...validForm, client_id: "some-other-client" });

        expect(overridesSentToStub().client_id).toBe("some-other-client");
    });

    it("rejects an invalid redirect host without calling the stub", async () => {
        const response = await submitForm({ ...validForm, authorise_base_url: "https://evil.example.com" });

        expect(response.status).toBe(400);
        expect(response.text).toContain("There is a problem");
        expect(response.text).toContain(`Enter either ${CRI_FRONTEND_URL} or a localhost address`);
        expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(0);
    });

    it("renders field errors", async () => {
        const response = await submitForm({ ...validForm, client_id: "  " });

        expect(response.status).toBe(400);
        expect(response.text).toContain("Enter an OAuth Client ID");
        expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(0);
    });

    it("renders stub failures", async () => {
        lambdaMock.on(InvokeCommand).resolves({
            Payload: encode({ statusCode: 400, body: JSON.stringify({ message: "Claims set failed validation" }) }),
        });

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
