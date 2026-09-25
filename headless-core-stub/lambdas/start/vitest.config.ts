import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        name: "headless-core-stub/lambdas/start",
    },
});
