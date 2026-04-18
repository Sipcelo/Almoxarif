import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  seedUser,
  loginAsAdmin,
  prisma,
} from "./helpers";

describe("GET /users — paginação (P2)", () => {
  let app: FastifyInstance;
  let cookie: string;

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
    // seed 24 operadores adicionais → total 25 (1 admin + 24)
    for (let i = 0; i < 24; i++) {
      const idx = String(i).padStart(2, "0");
      await seedUser({
        email: `op${idx}@rodoviariapel.com`,
        senha: "senha12345",
        nome: `Operador ${idx}`,
      });
    }
    cookie = await loginAsAdmin(app);
  });

  it("retorna shape { users, meta: { total, page, limit, totalPages } }", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.meta).toEqual({
      total: 25,
      page: 1,
      limit: 20,
      totalPages: 2,
    });
    expect(body.users).toHaveLength(20);
  });

  it("page=2 retorna 5 registros restantes", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users?page=2&limit=20",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.users).toHaveLength(5);
    expect(body.meta.page).toBe(2);
    expect(body.meta.totalPages).toBe(2);
  });

  it("limit customizado respeita cap (max 100)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users?limit=101",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("page<1 é rejeitado", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users?page=0",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("sem query params usa defaults page=1, limit=20", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users",
      headers: { cookie },
    });
    const body = res.json();
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(20);
  });

  it("filtro + paginação combinados", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users?role=operador&page=1&limit=10",
      headers: { cookie },
    });
    const body = res.json();
    expect(body.users).toHaveLength(10);
    expect(body.meta.total).toBe(24);
    expect(body.meta.totalPages).toBe(3);
    expect(body.users.every((u: { role: string }) => u.role === "operador")).toBe(true);
  });
});
