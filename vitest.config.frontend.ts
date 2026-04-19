import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test-frontend/**/*.test.{js,ts}"],
    globals: false,
    setupFiles: ["test-frontend/setup.ts"],
    testTimeout: 10000,
  },
});
