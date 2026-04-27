import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { prisma } from "../src/infra/prisma";
import { createApp } from "./helpers";

let app: FastifyInstance;

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await app.close();
  vi.restoreAllMocks();
  await prisma.$disconnect();
});

describe("SDD-006 health live/ready", () => {
  it("GET /health/live retorna 200 sem depender do banco", async () => {
    const spy = vi
      .spyOn(prisma, "$queryRaw")
      .mockRejectedValueOnce(new Error("db down"));

    const res = await app.inject({ method: "GET", url: "/health/live" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: "ok",
      service: "almox-backend",
      version: "1.0.0",
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("GET /health/ready retorna 200 quando banco esta conectado", async () => {
    const res = await app.inject({ method: "GET", url: "/health/ready" });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
    expect(res.json().checks.database).toBe("connected");
  });

  it("GET /health mantem contrato compativel com readiness", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
    expect(res.json().checks.database).toBe("connected");
  });

  it("GET /health/ready retorna 503 quando banco esta indisponivel", async () => {
    const spy = vi
      .spyOn(prisma, "$queryRaw")
      .mockRejectedValueOnce(new Error("simulated db down"));

    const res = await app.inject({ method: "GET", url: "/health/ready" });

    expect(res.statusCode).toBe(503);
    expect(res.json().status).toBe("degraded");
    expect(res.json().checks.database).toBe("unreachable");
    expect(JSON.stringify(res.json())).not.toContain("simulated db down");
    spy.mockRestore();
  });
});
