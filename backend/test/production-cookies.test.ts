import { afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app/server";
import { cleanDatabase, createApp, prisma, seedAdmin } from "./helpers";

function asArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

async function withProductionApp(
  fn: (app: FastifyInstance) => Promise<void>
): Promise<void> {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    SEED_ENABLED: process.env.SEED_ENABLED,
  };

  process.env.NODE_ENV = "production";
  process.env.CORS_ORIGIN = "https://almox.example";
  process.env.SEED_ENABLED = "false";

  const app = await buildApp();
  await app.ready();

  try {
    await fn(app);
  } finally {
    await app.close();
    restoreEnv("NODE_ENV", original.NODE_ENV);
    restoreEnv("CORS_ORIGIN", original.CORS_ORIGIN);
    restoreEnv("SEED_ENABLED", original.SEED_ENABLED);
  }
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("SDD-006 production cookies", () => {
  it("em producao login emite almox_sid com Secure", async () => {
    await withProductionApp(async (app) => {
      await cleanDatabase();
      await seedAdmin();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "admin@rodoviariapel.com", senha: "admin2026" },
      });

      const sid = asArray(res.headers["set-cookie"]).find((cookie) =>
        cookie.startsWith("almox_sid=")
      );
      expect(sid).toBeDefined();
      expect(sid).toMatch(/;\s*Secure/i);
    });
  });

  it("em producao login emite almox_csrf com Secure", async () => {
    await withProductionApp(async (app) => {
      await cleanDatabase();
      await seedAdmin();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "admin@rodoviariapel.com", senha: "admin2026" },
      });

      const csrf = asArray(res.headers["set-cookie"]).find((cookie) =>
        cookie.startsWith("almox_csrf=")
      );
      expect(csrf).toBeDefined();
      expect(csrf).toMatch(/;\s*Secure/i);
    });
  });

  it("em test login nao exige flag Secure", async () => {
    const app = await createApp();
    try {
      await cleanDatabase();
      await seedAdmin();

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "admin@rodoviariapel.com", senha: "admin2026" },
      });

      const sid = asArray(res.headers["set-cookie"]).find((cookie) =>
        cookie.startsWith("almox_sid=")
      );
      expect(sid).toBeDefined();
      expect(sid).not.toMatch(/;\s*Secure/i);
    } finally {
      await app.close();
    }
  });
});
