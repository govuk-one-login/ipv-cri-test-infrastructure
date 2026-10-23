import type { APIGatewayEventRequestContext, APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { beforeEach, describe, expect, it } from "vitest";
import { lambdaHandler } from "../src/handler/ui-handler";
import { configureEnvironment } from "./helpers/app";
import { startFunctionMock, startFunctionSucceeds } from "./helpers/start-function";

const EXECUTE_API_HOST = "blah.execute-api.eu-west-2.amazonaws.com";
const CUSTOM_DOMAIN_HOST = "test-resources.review-ob.dev.account.gov.uk";

type Response = APIGatewayProxyResult & { multiValueHeaders: Record<string, string[]> };

type RequestOptions = {
    method?: "GET" | "POST";
    host?: string;
    body?: string;
    query?: Record<string, string>;
};

// the bits of an APIGatewayProxyEvent that serverless-express and the app need
type UiEvent = Partial<Omit<APIGatewayProxyEvent, "requestContext">> & {
    requestContext: Pick<APIGatewayEventRequestContext, "stage">;
};

const apiGatewayEvent = (
    path: string,
    { method = "GET", host = EXECUTE_API_HOST, body, query }: RequestOptions = {},
): UiEvent => {
    const proxy = path.replace(/^\/ui\/?/, "");

    return {
        httpMethod: method,
        path,
        resource: proxy ? "/ui/{proxy+}" : "/ui",
        pathParameters: proxy ? { proxy } : null,
        multiValueQueryStringParameters: query
            ? Object.fromEntries(Object.entries(query).map(([key, value]) => [key, [value]]))
            : null,
        multiValueHeaders: {
            host: [host],
            "x-forwarded-proto": ["https"],
            ...(body && { "content-type": ["application/x-www-form-urlencoded"] }),
        },
        body: body ?? null,
        isBase64Encoded: false,
        requestContext: { stage: "dev" },
    };
};

const invoke = (path: string, options?: RequestOptions) =>
    lambdaHandler(apiGatewayEvent(path, options), {} as Context, () => {}) as Promise<Response>;

const locationFrom = (response: Response): string => {
    const [location] = response.multiValueHeaders.location;
    return location;
};

beforeEach(() => {
    startFunctionMock.reset();
    configureEnvironment();
});

describe("{proxy+} resource", () => {
    it("routes on the full path, not just the part {proxy+} matched", async () => {
        const response = await invoke("/ui/favicon.svg");

        expect(response.statusCode).toBe(200);
        expect(response.multiValueHeaders["content-type"]).toContainEqual(expect.stringContaining("image/svg+xml"));
    });

    it("keeps the query string", async () => {
        const response = await invoke("/ui/govuk.css", { query: { v: "2" } });

        expect(response.statusCode).toBe(200);
        expect(response.multiValueHeaders["content-type"]).toContainEqual(expect.stringContaining("text/css"));
    });
});

describe("form bodies", () => {
    it("are parsed", async () => {
        startFunctionSucceeds();

        const response = await invoke("/ui/start", {
            method: "POST",
            body: "client_id=some-client&authorise_base_url=http://localhost:4501",
        });

        expect(response.statusCode).toBe(302);
        expect(locationFrom(response)).toMatch(/^http:\/\/localhost:4501\/oauth2\/authorize\?/);
    });
});

describe("on the execute-api host", () => {
    it("prefixes the stage on links and form actions", async () => {
        const response = await invoke("/ui");

        expect(response.body).toContain('action="/dev/ui/start"');
        expect(response.body).toContain('href="/dev/ui/govuk.css"');
        expect(response.body).toContain('href="/dev/ui/favicon.svg"');
        expect(response.body).toContain('href="/dev/ui" class="govuk-generic-header__homepage-link"');
    });
});

describe("on the custom domain", () => {
    it("does not prefix links and form actions", async () => {
        const response = await invoke("/ui", { host: CUSTOM_DOMAIN_HOST });

        expect(response.body).toContain('action="/ui/start"');
        expect(response.body).toContain('href="/ui/govuk.css"');
        expect(response.body).toContain('href="/ui/favicon.svg"');
        expect(response.body).toContain('href="/ui" class="govuk-generic-header__homepage-link"');
    });
});
