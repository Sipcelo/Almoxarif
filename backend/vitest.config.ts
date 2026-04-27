import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    setupFiles: ["./test/setup.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
});
