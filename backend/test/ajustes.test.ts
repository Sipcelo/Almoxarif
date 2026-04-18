import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  seedUser,
  seedCategoria,
  seedDeposito,
  loginAsAdmin,
  login,
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

describe("Ajustes", () => {
  it("admin cria ajuste", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const item = await seedItem({ codigo: "ITM-A1", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 20 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ajustes",
      headers: { cookie: adminCookie },
      payload: { itemId: item.id, qtdNova: 15, motivo: "Correcao de contagem" },
    });

    expect(res.statusCode).toBe(201);
    expect(await getItemSaldo(item.id)).toBe(15);
  });

  it("operador nao pode ajustar (403)", async () => {
    await seedUser({ email: "op@x.com", senha: "senha12345", role: "operador" });
    const opCookie = await login(app, "op@x.com", "senha12345");
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const item = await seedItem({ codigo: "ITM-A2", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 20 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ajustes",
      headers: { cookie: opCookie },
      payload: { itemId: item.id, qtdNova: 15, motivo: "Correcao de contagem" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("motivo ausente -> 400", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const item = await seedItem({ codigo: "ITM-A3", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 20 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ajustes",
      headers: { cookie: adminCookie },
      payload: { itemId: item.id, qtdNova: 10, motivo: "x" },
    });

    expect(res.statusCode).toBe(400);
  });
});
