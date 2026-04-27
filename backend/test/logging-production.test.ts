import { describe, expect, it } from "vitest";
import { validateEnv } from "../src/config/env";
import { LOG_REDACT_PATHS, loggerOptions } from "../src/infra/logger-options";

describe("SDD-006 production logging", () => {
  it("loggerOptions redige cookies, authorization e senhas", () => {
    const options = loggerOptions();

    expect(options.redact.paths).toEqual(LOG_REDACT_PATHS);
    expect(options.redact.paths).toEqual(
      expect.arrayContaining([
        "req.headers.cookie",
        "req.headers.authorization",
        "req.body.senha",
        "req.body.password",
        "req.body.novaSenha",
        "res.headers['set-cookie']",
      ])
    );
    expect(options.redact.censor).toBe("[REDACTED]");
  });

  it("erro de env nao imprime valores sensiveis", () => {
    const env = {
      NODE_ENV: "production",
      DATABASE_URL: "file:./secret-prod.db",
      SESSION_SECRET: "super-secret-value-with-more-than-32-chars",
      CORS_ORIGIN: "*",
      SEED_ENABLED: "true",
    };

    expect(() => validateEnv(env)).toThrow(/DATABASE_URL/);

    try {
      validateEnv(env);
    } catch (err) {
      const message = String((err as Error).message);
      expect(message).not.toContain(env.DATABASE_URL);
      expect(message).not.toContain(env.SESSION_SECRET);
      expect(message).not.toContain("super-secret-value");
    }
  });
});
