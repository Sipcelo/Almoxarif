import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { cleanDatabase, createApp, loginAsAdmin, seedAdmin, prisma } from "./helpers";

let app: FastifyInstance;

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase();
  await seedAdmin();
});

describe("SDD-006 security headers", () => {
  it("inclui headers minimos em rota publica", async () => {
    const res = await app.inject({ method: "GET", url: "/health/live" });

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["permissions-policy"]).toContain("camera=()");
    expect(res.headers["content-security-policy"]).toContain("default-src");
  });

  it("inclui Cache-Control no-store em rota autenticada", async () => {
    const cookie = await loginAsAdmin(app);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("nao remove Set-Cookie do login", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@rodoviariapel.com", senha: "admin2026" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
