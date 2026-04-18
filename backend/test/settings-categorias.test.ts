import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  seedCategoria,
  loginAsAdmin,
  prisma,
} from "./helpers";

let app: FastifyInstance;
let adminCookie: string;

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
  adminCookie = await loginAsAdmin(app);
});

describe("Settings — Categorias", () => {
  it("cria categoria com nome normalizado", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/categorias",
      headers: { cookie: adminCookie },
      payload: { nome: "  Ferramentas  " },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().categoria.nome).toBe("ferramentas");
  });

  it("409 em nome duplicado (case-insensitive)", async () => {
    await seedCategoria("epi");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/categorias",
      headers: { cookie: adminCookie },
      payload: { nome: "EPI" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("atualiza e desativa categoria (soft delete idempotente)", async () => {
    const c = await seedCategoria("temporaria");
    const r1 = await app.inject({
      method: "DELETE",
      url: `/api/v1/settings/categorias/${c.id}`,
      headers: { cookie: adminCookie },
    });
    expect(r1.statusCode).toBe(200);
    const after = await prisma.categoria.findUnique({ where: { id: c.id } });
    expect(after?.ativo).toBe(false);

    const r2 = await app.inject({
      method: "DELETE",
      url: `/api/v1/settings/categorias/${c.id}`,
      headers: { cookie: adminCookie },
    });
    expect(r2.statusCode).toBe(200);
  });

  it("404 em id inexistente", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/settings/categorias/00000000-0000-0000-0000-000000000000",
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
