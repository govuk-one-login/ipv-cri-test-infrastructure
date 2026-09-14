import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { BOLD_FONT_URL, CREST_URL, inlineAssets, LIGHT_FONT_URL } from "../src/util/inline-assets";

const require = createRequire(import.meta.url);
const realStylesheet = readFileSync(require.resolve("govuk-frontend/dist/govuk/govuk-frontend.min.css"), "utf8");

const dataUris = {
    lightFont: "data:font/woff2;base64,LIGHT",
    boldFont: "data:font/woff2;base64,BOLD",
    crest: "data:image/svg+xml;base64,CREST",
};

describe("inlineAssets", () => {
    it("knows the url of every asset the stylesheet references", () => {
        expect(realStylesheet).toContain(LIGHT_FONT_URL);
        expect(realStylesheet).toContain(BOLD_FONT_URL);
        expect(realStylesheet).toContain(CREST_URL);

        expect(inlineAssets(realStylesheet, dataUris)).not.toContain("/assets/");
    });

    it("inlines the fonts and crest", () => {
        const result = inlineAssets(realStylesheet, dataUris);

        expect(result).toContain("url(data:font/woff2;base64,LIGHT)");
        expect(result).toContain("url(data:font/woff2;base64,BOLD)");
        expect(result).toContain("url(data:image/svg+xml;base64,CREST)");
    });

    it("removes the woff fallbacks", () => {
        const result = inlineAssets(realStylesheet, dataUris);

        expect(result).not.toContain('format("woff")');
        expect(result).toContain('format("woff2")');
    });
});
