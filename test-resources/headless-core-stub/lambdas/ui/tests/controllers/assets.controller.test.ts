import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { FAVICON_PATH, STYLESHEET_PATH } from "../../src/paths";

describe("assets", () => {
    it("serves the stylesheet", async () => {
        const response = await request(createApp()).get(STYLESHEET_PATH);

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("text/css");
        expect(response.headers["cache-control"]).toContain("immutable");
    });

    it("serves the favicon", async () => {
        const response = await request(createApp()).get(FAVICON_PATH).buffer(true);

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("image/svg+xml");
        expect(response.body.toString()).toContain("<svg");
    });
});
