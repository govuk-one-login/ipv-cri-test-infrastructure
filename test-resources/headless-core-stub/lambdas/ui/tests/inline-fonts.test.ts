import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { BOLD_FONT_URL, inlineFonts, LIGHT_FONT_URL } from "../src/util/inline-fonts";

const require = createRequire(import.meta.url);
const govukFrontend = (path: string) => require.resolve(`govuk-frontend/dist/govuk/${path}`);

const realStylesheet = readFileSync(govukFrontend("govuk-frontend.min.css"), "utf8");

const dataUri = (path: string) =>
    `data:font/woff2;base64,${readFileSync(govukFrontend(`assets/fonts/${path}`)).toString("base64")}`;

describe("inlineFonts", () => {
    it("rewrites all font references", () => {
        expect(realStylesheet).toContain(LIGHT_FONT_URL);
        expect(realStylesheet).toContain(BOLD_FONT_URL);

        const result = inlineFonts(
            realStylesheet,
            dataUri("light-94a07e06a1-v2.woff2"),
            dataUri("bold-b542beb274-v2.woff2"),
        );

        expect(result).not.toContain("/assets/fonts/");
        expect(result).toContain("src:url(data:font/woff2;base64,");
        expect(result.match(/data:font\/woff2;base64,/g)).toHaveLength(2);
    });

    it("removes the woff fallbacks", () => {
        const result = inlineFonts(realStylesheet, "data:font/woff2;base64,LIGHT", "data:font/woff2;base64,BOLD");

        expect(result).not.toContain('format("woff")');
        expect(result).toContain('format("woff2")');
    });
});
