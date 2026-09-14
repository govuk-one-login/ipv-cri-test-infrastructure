import { getCurrentInvoke } from "@codegenie/serverless-express";
import type { Request, Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { resolveBasePath } from "../src/util/base-path";
import { configureEnvironment } from "./helpers/app";

vi.mock("@codegenie/serverless-express", () => ({ getCurrentInvoke: vi.fn() }));

const EXECUTE_API_HOST = "blah.execute-api.eu-west-2.amazonaws.com";
const CUSTOM_DOMAIN_HOST = "test-resources.review-ob.dev.account.gov.uk";

beforeEach(() => {
    configureEnvironment();
    vi.mocked(getCurrentInvoke).mockReturnValue({ event: { requestContext: { stage: "dev" } } } as never);
});

describe("{proxy+} resources", () => {
    it("route on the full requested path, not the part {proxy+} matched", async () => {
        vi.mocked(getCurrentInvoke).mockReturnValue({
            event: { path: "/ui/sign-in", requestContext: { stage: "dev" } },
        } as never);

        const response = await request(createApp()).get("/sign-in").set("Host", EXECUTE_API_HOST);

        expect(response.status).toBe(200);
        expect(response.text).toContain('action="/dev/ui/sign-in"');
    });

    it("keep the query string", async () => {
        vi.mocked(getCurrentInvoke).mockReturnValue({
            event: { path: "/ui/govuk.css", requestContext: { stage: "dev" } },
        } as never);

        const response = await request(createApp()).get("/govuk.css?v=2").set("Host", EXECUTE_API_HOST);

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("text/css");
    });
});

describe("execute-api", () => {
    it("prefixes the stage on links and form actions", async () => {
        const response = await request(createApp()).get("/ui/sign-in").set("Host", EXECUTE_API_HOST);

        expect(response.text).toContain('action="/dev/ui/sign-in"');
        expect(response.text).toContain('href="/dev/ui/govuk.css"');
        expect(response.text).toContain('href="/dev/ui/favicon.svg"');
    });

    it("prefixes the stage on redirects", async () => {
        const response = await request(createApp()).get("/ui").set("Host", EXECUTE_API_HOST);

        expect(response.headers.location).toBe("/dev/ui/sign-in");
    });
});

describe("custom domain", () => {
    it("does not prefix links and form actions", async () => {
        const response = await request(createApp()).get("/ui/sign-in").set("Host", CUSTOM_DOMAIN_HOST);

        expect(response.text).toContain('action="/ui/sign-in"');
        expect(response.text).toContain('href="/ui/govuk.css"');
        expect(response.text).toContain('href="/ui/favicon.svg"');
    });

    it("does not prefix redirects", async () => {
        const response = await request(createApp()).get("/ui").set("Host", CUSTOM_DOMAIN_HOST);

        expect(response.headers.location).toBe("/ui/sign-in");
    });
});

describe("absolute urls", () => {
    it("are never prefixed", () => {
        const authoriseUrl = "https://review-ob.dev.account.gov.uk/oauth2/authorize?client_id=x";
        const redirect = vi.fn();
        const res = { locals: {}, redirect } as unknown as Response;

        resolveBasePath({ hostname: EXECUTE_API_HOST } as Request, res, vi.fn());
        res.redirect(302, authoriseUrl);

        expect(redirect).toHaveBeenCalledWith(302, authoriseUrl);
    });
});
