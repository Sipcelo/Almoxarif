import { describe, it, expect } from "vitest";

describe("Environment Validation Tests", () => {
  it("should validate required environment variables", () => {
    const requiredEnvVars = ["DATABASE_URL", "SESSION_SECRET"];

    requiredEnvVars.forEach((envVar) => {
      expect(process.env[envVar]).toBeDefined();
    });
  });
});
