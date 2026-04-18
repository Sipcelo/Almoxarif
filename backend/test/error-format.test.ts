import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { createApp } from "./helpers";

let app: FastifyInstance;

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await app.close();
});

describe("Erro padronizado { error: { code, message, details } }", () => {
  it("404 em rota inexistente", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/rota-inexistente",
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(typeof body.error.message).toBe("string");
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("401 em rota protegida sem cookie", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users",
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Sessão expirada ou inválida");
  });
});
