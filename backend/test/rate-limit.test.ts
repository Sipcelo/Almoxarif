import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { createApp } from "./helpers";

let app: FastifyInstance;

beforeAll(async () => {
  process.env.RATE_LIMIT_MAX = "5";
  process.env.RATE_LIMIT_WINDOW_MS = "60000";
  app = await createApp();
});

afterAll(async () => {
  await app.close();
});

describe("Rate Limit — formato de erro padronizado", () => {
  it("retorna 429 com { error: { code: RATE_LIMITED, ... } } em PT", async () => {
    for (let i = 0; i < 5; i++) {
      await app.inject({ method: "GET", url: "/api/v1/auth/me" });
    }
    const res = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(res.statusCode).toBe(429);
    const body = res.json();
    expect(body.error).toMatchObject({
      code: "RATE_LIMITED",
      message: "Limite de requisições excedido. Tente novamente em breve.",
    });
  });
});
