import { InvokeCommand, type InvokeCommandOutput, LambdaClient } from "@aws-sdk/client-lambda";
import { mockClient } from "aws-sdk-client-mock";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const lambdaMock = mockClient(LambdaClient);

const CRI_FRONTEND_URL = "https://review-ob.dev.account.gov.uk";
const CREDENTIALS = { username: "tester", password: "s3cret" }; // pragma: allowlist secret

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)) as InvokeCommandOutput["Payload"];

const resolveStart = () =>
    lambdaMock.on(InvokeCommand).resolves({
        Payload: encode({
            statusCode: 200,
            body: JSON.stringify({ client_id: "ipv-core-stub-aws-headless", request: "encrypted.jwt" }),
        }),
    });

const submit = (form: Record<string, string>) =>
    request(createApp()).post("/ui/start").auth(CREDENTIALS.username, CREDENTIALS.password).type("form").send(form);

const validForm = {
    client_id: "ipv-core-stub-aws-headless",
    authorise_base_url: CRI_FRONTEND_URL,
};

beforeEach(() => {
    lambdaMock.reset();
    process.env.UI_BASIC_AUTH_CREDENTIALS = `${CREDENTIALS.username}:${CREDENTIALS.password}`;
    process.env.CRI_FRONTEND_URL = CRI_FRONTEND_URL;
    process.env.START_FUNCTION_NAME = "test-resources-StartFunction:live";
});

describe("basic auth", () => {
    it("challenges when no creds are sent", async () => {
        const response = await request(createApp()).get("/ui");

        expect(response.status).toBe(401);
        expect(response.headers["www-authenticate"]).toMatch(/^Basic realm="CRI Journey Builder"/);
    });

    it("rejects wrong password", async () => {
        const response = await request(createApp()).get("/ui").auth(CREDENTIALS.username, "wrong");

        expect(response.status).toBe(401);
    });

    it("errors when no creds are configured", async () => {
        delete process.env.UI_BASIC_AUTH_CREDENTIALS;
        delete process.env.BASIC_AUTH_PARAM_NAME;

        const response = await request(createApp()).get("/ui").auth(CREDENTIALS.username, CREDENTIALS.password);

        expect(response.status).toBe(503);
    });

    it("does not protect the stylesheet", async () => {
        const response = await request(createApp()).get("/ui/govuk.css");

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("text/css");
    });

    it("does not protect the favicon", async () => {
        const response = await request(createApp()).get("/ui/favicon.svg").buffer(true);

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("image/svg+xml");
        expect(response.body.toString()).toContain("<svg");
    });
});

describe("GET /ui", () => {
    it("renders the form with defaults", async () => {
        const response = await request(createApp()).get("/ui").auth(CREDENTIALS.username, CREDENTIALS.password);

        expect(response.status).toBe(200);
        expect(response.text).toMatch(/<title>Start a journey - .+<\/title>/);
        expect(response.text).toContain('<link rel="icon" sizes="any" href="/ui/favicon.svg" type="image/svg+xml">');
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

        const response = await submit(validForm);

        expect(response.status).toBe(302);
        const location = new URL(response.headers.location);
        expect(location.origin).toBe(CRI_FRONTEND_URL);
        expect(location.pathname).toBe("/oauth2/authorize");
        expect(location.searchParams.get("client_id")).toBe("ipv-core-stub-aws-headless");
        expect(location.searchParams.get("request")).toBe("encrypted.jwt");

        const payload = JSON.parse(lambdaMock.commandCalls(InvokeCommand)[0].args[0].input.Payload as string);
        const overrides = JSON.parse(payload.body);
        expect(overrides.shared_claims.name[0].nameParts).toEqual([
            { type: "GivenName", value: "KENNETH" },
            { type: "FamilyName", value: "DECERQUEIRA" },
        ]);
        expect(overrides.shared_claims.address).toHaveLength(1);
    });

    it("redirects to a locally running front", async () => {
        resolveStart();

        const response = await submit({ ...validForm, authorise_base_url: "http://localhost:4501" });

        expect(response.status).toBe(302);
        expect(response.headers.location).toMatch(/^http:\/\/localhost:4501\/oauth2\/authorize\?/);
    });

    it("passes a custom client id to the stub", async () => {
        resolveStart();

        await submit({ ...validForm, client_id: "some-other-client" });

        const payload = JSON.parse(lambdaMock.commandCalls(InvokeCommand)[0].args[0].input.Payload as string);
        expect(JSON.parse(payload.body).client_id).toBe("some-other-client");
    });

    it("rejects an invalid redirect host without calling the stub", async () => {
        const response = await submit({ ...validForm, authorise_base_url: "https://evil.example.com" });

        expect(response.status).toBe(400);
        expect(response.text).toContain("There is a problem");
        expect(response.text).toContain(`Enter either ${CRI_FRONTEND_URL} or a localhost address`);
        expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(0);
    });

    it("render form errors", async () => {
        const response = await submit({ ...validForm, client_id: "  " });

        expect(response.status).toBe(400);
        expect(response.text).toContain("Enter an OAuth Client ID");
        expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(0);
    });

    it("renders stub failures", async () => {
        lambdaMock.on(InvokeCommand).resolves({
            Payload: encode({ statusCode: 400, body: JSON.stringify({ message: "Claims set failed validation" }) }),
        });

        const response = await submit(validForm);

        expect(response.status).toBe(502);
        expect(response.text).toContain("Claims set failed validation");
    });

    it("escapes user input", async () => {
        const response = await submit({
            ...validForm,
            client_id: '"><script>alert(1)</script>',
            authorise_base_url: "https://evil.example.com",
        });

        expect(response.status).toBe(400);
        expect(response.text).not.toContain("<script>alert(1)</script>");
        expect(response.text).toContain("&quot;&gt;&lt;script&gt;");
    });
});
