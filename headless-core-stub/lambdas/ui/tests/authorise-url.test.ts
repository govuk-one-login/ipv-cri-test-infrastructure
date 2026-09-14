import { describe, expect, it } from "vitest";
import {
    buildAuthoriseUrl,
    InvalidAuthoriseBaseError,
    isAllowedAuthoriseBase,
    parseAuthoriseBase,
} from "../src/util/authorise-url";

const CRI_FRONTEND_URL = "https://review-ob.dev.account.gov.uk";

const build = (base: string) =>
    buildAuthoriseUrl({
        base: parseAuthoriseBase(base, CRI_FRONTEND_URL),
        clientId: "ipv-core-stub-aws-headless",
        request: "encrypted.jwt.value",
    });

describe("parseAuthoriseBase", () => {
    it("accepts the deployed CRI front", () => {
        expect(parseAuthoriseBase(CRI_FRONTEND_URL, CRI_FRONTEND_URL).origin).toBe(CRI_FRONTEND_URL);
    });

    it("accepts a localhost front on any port", () => {
        expect(parseAuthoriseBase("http://localhost:4501", CRI_FRONTEND_URL).port).toBe("4501");
        expect(parseAuthoriseBase("http://127.0.0.1:8080", CRI_FRONTEND_URL).hostname).toBe("127.0.0.1");
    });

    it.each([
        ["https://evil.example.com", "another host"],
        ["https://review-ob.dev.account.gov.uk.evil.com", "a suffixed host"],
        ["http://review-ob.dev.account.gov.uk", "a non-https scheme on the CRI host"],
        ["javascript:alert(1)", "a non-http scheme"],
        ["not a url", "an unparseable value"],
    ])("rejects %s (%s)", (base) => {
        expect(() => parseAuthoriseBase(base, CRI_FRONTEND_URL)).toThrow(InvalidAuthoriseBaseError);
    });
});

describe("buildAuthoriseUrl", () => {
    it("builds the authorise url for the deployed CRI", () => {
        const url = build(CRI_FRONTEND_URL);

        expect(url.origin).toBe(CRI_FRONTEND_URL);
        expect(url.pathname).toBe("/oauth2/authorize");
        expect(Object.fromEntries(url.searchParams)).toEqual({
            client_id: "ipv-core-stub-aws-headless",
            request: "encrypted.jwt.value",
            response_type: "code",
        });
    });

    it("points at localhost front when given one", () => {
        expect(build("http://localhost:4501").toString()).toMatch(/^http:\/\/localhost:4501\/oauth2\/authorize\?/);
    });

    it("replaces the path on the supplied base", () => {
        expect(build("http://localhost:4501/some/path").pathname).toBe("/oauth2/authorize");
    });
});

describe("isAllowedAuthoriseBase", () => {
    it("ignores an unparseable configured CRI url rather than throwing", () => {
        expect(isAllowedAuthoriseBase(new URL("https://review-ob.dev.account.gov.uk"), "crumbs")).toBe(false);
    });
});
