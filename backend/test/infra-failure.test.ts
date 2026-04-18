import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { FastifyInstance } from "fastify";
import { validateEnv } from "../src/config/env";
import { buildApp } from "../src/app/server";
import { createApp, cleanDatabase } from "./helpers";
import { prisma } from "../src/infra/prisma";

describe("Infra failure — CA-I3 SESSION_SECRET", () => {
  it("validateEnv() lança quando SESSION_SECRET está ausente", () => {
    const fake: NodeJS.ProcessEnv = {
      DATABASE_URL: "postgresql://u:p@localhost:5432/test",
    };
    expect(() => validateEnv(fake)).toThrow(/SESSION_SECRET/);
  });

  it("validateEnv() lança quando SESSION_SECRET é curto demais", () => {
    const fake: NodeJS.ProcessEnv = {
      DATABASE_URL: "postgresql://u:p@localhost:5432/test",
      SESSION_SECRET: "curto",
    };
    expect(() => validateEnv(fake)).toThrow(/SESSION_SECRET/);
  });

  it("validateEnv() lança quando DATABASE_URL está ausente", () => {
    const fake: NodeJS.ProcessEnv = {
      SESSION_SECRET: "x".repeat(64),
    };
    expect(() => validateEnv(fake)).toThrow(/DATABASE_URL/);
  });

  it("buildApp() falha quando SESSION_SECRET é removido do ambiente", async () => {
    const original = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    await expect(buildApp()).rejects.toThrow(/SESSION_SECRET/);
    process.env.SESSION_SECRET = original;
  });
});

describe("Infra failure — CA-I2 healthcheck com DB down", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it("GET /health retorna 503 com estado degradado quando DB cai", async () => {
    const spy = vi
      .spyOn(prisma, "$queryRaw")
      .mockRejectedValueOnce(new Error("simulated DB down"));

    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toBe("unreachable");
    // erro interno não vaza stack nem mensagem bruta da exceção
    expect(JSON.stringify(body)).not.toContain("simulated DB down");

    spy.mockRestore();
  });

  it("GET /health volta a 200 após recuperação do DB", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
    expect(res.json().checks.database).toBe("connected");
  });
});
