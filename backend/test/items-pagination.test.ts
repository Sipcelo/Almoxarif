import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createApp, cleanDatabase, seedAdmin, seedCategoria, seedDeposito, loginAsAdmin, seedItem, prisma } from "./helpers";

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

describe("Items pagination", () => {
  it("shape {items, meta}", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    for (let i = 0; i < 3; i++) {
      await seedItem({ codigo: `ITM-P${i}`, categoriaId: categoria.id, depositoId: deposito.id, quantidade: i, minimo: 2 });
    }

    const res = await app.inject({ method: "GET", url: "/api/v1/items", headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().items)).toBe(true);
    expect(res.json().meta.total).toBe(3);
  });

  it("cap limit=100", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/items?limit=101", headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(400);
  });

  it("filtro baixoEstoque=true", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    await seedItem({ codigo: "ITM-L1", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 2, minimo: 5 });
    await seedItem({ codigo: "ITM-L2", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 10, minimo: 5 });
    await seedItem({ codigo: "ITM-L3", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 5, minimo: 5 });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/items?baixoEstoque=true",
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
    expect(res.json().items[0].codigo).toBe("ITM-L1");
  });
});
