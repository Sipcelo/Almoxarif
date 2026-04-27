import { describe, expect, it } from "vitest";
import { validateEnv } from "../src/config/env";

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/almox",
  SESSION_SECRET: "x".repeat(64),
  CORS_ORIGIN: "https://almox.example",
  SEED_ENABLED: "false",
};

describe("SDD-006 production env validation", () => {
  it("falha em producao sem CORS_ORIGIN", () => {
    const env = { ...baseEnv };
    delete env.CORS_ORIGIN;
    expect(() => validateEnv(env)).toThrow(/CORS_ORIGIN/);
  });

  it("falha em producao com CORS_ORIGIN wildcard", () => {
    expect(() => validateEnv({ ...baseEnv, CORS_ORIGIN: "*" })).toThrow(
      /wildcard/
    );
  });

  it("falha em producao com SEED_ENABLED=true", () => {
    expect(() => validateEnv({ ...baseEnv, SEED_ENABLED: "true" })).toThrow(
      /SEED_ENABLED/
    );
  });

  it("falha em producao com DATABASE_URL que nao e PostgreSQL", () => {
    expect(() =>
      validateEnv({ ...baseEnv, DATABASE_URL: "file:./dev.db" })
    ).toThrow(/DATABASE_URL/);
  });

  it("aceita env produtiva valida", () => {
    expect(() => validateEnv(baseEnv)).not.toThrow();
  });
});
