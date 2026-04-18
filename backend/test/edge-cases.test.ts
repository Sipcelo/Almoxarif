import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  loginAsAdmin,
  prisma,
  ADMIN_EMAIL,
  ADMIN_SENHA,
} from "./helpers";

let app: FastifyInstance;
let adminCookie: string;

beforeAll(async () => {
  app = await createApp();
  await cleanDatabase();
  await seedAdmin();
  adminCookie = await loginAsAdmin(app);
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("Edge cases (§6)", () => {
  it("E4 — login aceita email em case diferente (normalização lowercase)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ADMIN_EMAIL.toUpperCase(), senha: ADMIN_SENHA },
    });
    expect(res.statusCode).toBe(200);
  });

  it("E11 — email duplicado no POST /users → 409 CONFLICT", async () => {
    const payload = {
      nome: "Dup",
      email: "dup@rodoviariapel.com",
      senha: "senha12345",
      role: "operador",
    };
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: { cookie: adminCookie },
      payload,
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: { cookie: adminCookie },
      payload,
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe("CONFLICT");
    expect(second.json().error.message).toBe("E-mail já cadastrado");
  });

  it("E12 — role inválido → 400 VALIDATION_ERROR", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: { cookie: adminCookie },
      payload: {
        nome: "Invalid Role",
        email: "invrole@rodoviariapel.com",
        senha: "senha12345",
        role: "superuser",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(res.json().error.details)).toBe(true);
  });

  it("E13 — campos extras no payload são descartados (strip)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: { cookie: adminCookie },
      payload: {
        nome: "Strip Test",
        email: "strip@rodoviariapel.com",
        senha: "senha12345",
        role: "operador",
        campoNaoPrevisto: "xyz",
        senhaSecreta: "hack",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user).not.toHaveProperty("campoNaoPrevisto");
    expect(JSON.stringify(body).includes("hack")).toBe(false);
  });

  it("E16 — cookie almox_sid vazio → 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: "almox_sid=" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHORIZED");
  });

  it("E16 — cookie com UUID inexistente → 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: "almox_sid=00000000-0000-0000-0000-000000000000" },
    });
    expect(res.statusCode).toBe(401);
  });
});
