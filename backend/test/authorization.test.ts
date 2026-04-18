import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  seedUser,
  login,
  prisma,
} from "./helpers";

let app: FastifyInstance;
let operadorCookie: string;

beforeAll(async () => {
  app = await createApp();
  await cleanDatabase();
  await seedAdmin();
  await seedUser({
    email: "op-autz@rodoviariapel.com",
    senha: "senha12345",
    role: "operador",
  });
  operadorCookie = await login(app, "op-autz@rodoviariapel.com", "senha12345");
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("Autorização (§5.8) — operador não acessa rotas de users", () => {
  const routes: Array<{ method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"; url: string; body?: unknown }> = [
    { method: "GET", url: "/api/v1/users" },
    { method: "GET", url: "/api/v1/users/any-id" },
    {
      method: "POST",
      url: "/api/v1/users",
      body: { nome: "X", email: "x@x.com", senha: "senha12345", role: "operador" },
    },
    { method: "PUT", url: "/api/v1/users/any-id", body: { nome: "Y" } },
    { method: "PATCH", url: "/api/v1/users/any-id/password", body: { novaSenha: "senha12345" } },
    { method: "DELETE", url: "/api/v1/users/any-id" },
  ];

  for (const r of routes) {
    it(`${r.method} ${r.url} → 403 FORBIDDEN`, async () => {
      const res = await app.inject({
        method: r.method,
        url: r.url,
        headers: { cookie: operadorCookie },
        payload: r.body as any,
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("FORBIDDEN");
    });
  }
});
