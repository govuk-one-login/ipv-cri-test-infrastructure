export const LIGHT_FONT_URL = "/assets/fonts/light-94a07e06a1-v2.woff2";
export const BOLD_FONT_URL = "/assets/fonts/bold-b542beb274-v2.woff2";

// govuk stylesheets point at `/assets/fonts/*` which are not actually hosted anywhere so we inline as data URIs instead
export const inlineFonts = (css: string, light: string, bold: string): string =>
    css
        .replaceAll(LIGHT_FONT_URL, light)
        .replaceAll(BOLD_FONT_URL, bold)
        .replace(/,url\(\/assets\/fonts\/[^)]+\.woff\) format\("woff"\)/g, "");
