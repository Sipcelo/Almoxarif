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
  getItemSaldo,
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

describe("Entradas", () => {
  it("entrada valida incrementa saldo", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const item = await seedItem({ codigo: "ITM-E1", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 3 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/entradas",
      headers: { cookie: adminCookie },
      payload: { itemId: item.id, qtd: 4, valorUnit: 9.9 },
    });

    expect(res.statusCode).toBe(201);
    expect(await getItemSaldo(item.id)).toBe(7);
  });

  it("item inexistente -> 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/entradas",
      headers: { cookie: adminCookie },
      payload: { itemId: "11111111-1111-1111-1111-111111111111", qtd: 1, valorUnit: 10 },
    });

    expect(res.statusCode).toBe(404);
  });

  it("qtd invalida -> 400", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const item = await seedItem({ codigo: "ITM-E2", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 3 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/entradas",
      headers: { cookie: adminCookie },
      payload: { itemId: item.id, qtd: 0, valorUnit: 10 },
    });

    expect(res.statusCode).toBe(400);
  });
});
