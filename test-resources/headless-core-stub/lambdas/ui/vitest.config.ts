import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vitest/config";

const TEXT_EXTENSIONS = [".njk", ".svg"]; // vite already handles .css and .woff2

const bundledAsText = (): Plugin => ({
    name: "bundled-as-text",
    enforce: "pre",
    load(id) {
        if (TEXT_EXTENSIONS.some((extension) => id.endsWith(extension))) {
            return `export default ${JSON.stringify(readFileSync(id, "utf8"))};`;
        }
    },
});

export default defineConfig({
    plugins: [bundledAsText()],
    test: {
        globals: true,
        name: "headless-core-stub/lambdas/ui",
    },
});
