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

describe("Items rules", () => {
  it("categoria inexistente no create -> 400", async () => {
    const deposito = await seedDeposito("principal");

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/items",
      headers: { cookie: adminCookie },
      payload: {
        codigo: "ITM-009",
        descricao: "Sem categoria valida",
        categoriaId: "11111111-1111-1111-1111-111111111111",
        depositoId: deposito.id,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("deposito inexistente no create -> 400", async () => {
    const categoria = await seedCategoria("geral");

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/items",
      headers: { cookie: adminCookie },
      payload: {
        codigo: "ITM-009B",
        descricao: "Sem deposito valido",
        categoriaId: categoria.id,
        depositoId: "11111111-1111-1111-1111-111111111111",
        quantidade: 0,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("409 para codigo duplicado", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    await seedItem({ codigo: "ITM-010", categoriaId: categoria.id, depositoId: deposito.id });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/items",
      headers: { cookie: adminCookie },
      payload: {
        codigo: "ITM-010",
        descricao: "Duplicado",
        categoriaId: categoria.id,
        depositoId: deposito.id,
      },
    });

    expect(res.statusCode).toBe(409);
  });

  it("bloqueia update de quantidade via PUT /items", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const item = await seedItem({ codigo: "ITM-011", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 8 });

    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/items/${item.id}`,
      headers: { cookie: adminCookie },
      payload: { quantidade: 99 },
    });

    expect(res.statusCode).toBe(400);
    const after = await prisma.item.findUnique({ where: { id: item.id } });
    expect(after?.quantidade).toBe(8);
  });

  it("item inativo nao aceita entrada", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const item = await seedItem({ codigo: "ITM-012", categoriaId: categoria.id, depositoId: deposito.id, ativo: false });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/entradas",
      headers: { cookie: adminCookie },
      payload: { itemId: item.id, qtd: 1, valorUnit: 10 },
    });

    expect(res.statusCode).toBe(409);
  });

  it("item inativo nao aceita saida", async () => {
    const setor = await prisma.setor.create({ data: { nome: "almoxarifado" } });
    const funcionario = await prisma.funcionario.create({ data: { nome: "Fulano", cargo: "C", setorId: setor.id } });
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const item = await seedItem({ codigo: "ITM-013", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 10, ativo: false });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/saidas",
      headers: { cookie: adminCookie },
      payload: { itemId: item.id, funcionarioId: funcionario.id, qtd: 1, valorUnit: 10 },
    });

    expect(res.statusCode).toBe(409);
  });
});
