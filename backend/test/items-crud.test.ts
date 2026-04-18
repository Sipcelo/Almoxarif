import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  seedCategoria,
  seedDeposito,
  loginAsAdmin,
  seedItem,
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

describe("Items CRUD", () => {
  it("cria item (201)", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/items",
      headers: { cookie: adminCookie },
      payload: {
        codigo: "ITM-001",
        descricao: "Papel A4",
        categoriaId: categoria.id,
        depositoId: deposito.id,
        quantidade: 10,
        minimo: 2,
        valorAtual: 12.5,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().item.codigo).toBe("ITM-001");
  });

  it("lista e detalha item", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const item = await seedItem({ codigo: "ITM-002", categoriaId: categoria.id, depositoId: deposito.id });

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/items",
      headers: { cookie: adminCookie },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().meta.total).toBe(1);

    const getRes = await app.inject({
      method: "GET",
      url: `/api/v1/items/${item.id}`,
      headers: { cookie: adminCookie },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().item.id).toBe(item.id);
  });

  it("atualiza item (200)", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const item = await seedItem({ codigo: "ITM-003", categoriaId: categoria.id, depositoId: deposito.id });

    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/items/${item.id}`,
      headers: { cookie: adminCookie },
      payload: { descricao: "Papel A3", minimo: 5 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().item.descricao).toBe("Papel A3");
    expect(res.json().item.minimo).toBe(5);
  });

  it("soft delete de item (200) e idempotente", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const item = await seedItem({ codigo: "ITM-004", categoriaId: categoria.id, depositoId: deposito.id });

    const del1 = await app.inject({
      method: "DELETE",
      url: `/api/v1/items/${item.id}`,
      headers: { cookie: adminCookie },
    });
    expect(del1.statusCode).toBe(200);

    const del2 = await app.inject({
      method: "DELETE",
      url: `/api/v1/items/${item.id}`,
      headers: { cookie: adminCookie },
    });
    expect(del2.statusCode).toBe(200);

    const after = await prisma.item.findUnique({ where: { id: item.id } });
    expect(after?.ativo).toBe(false);
  });
});
