import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  seedUser,
  seedCategoria,
  seedDeposito,
  seedSetor,
  seedFuncionario,
  login,
  loginAsAdmin,
  seedItem,
  prisma,
} from "./helpers";

let app: FastifyInstance;

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
});

describe("Stock authorization", () => {
  it("401 sem cookie", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/items" });
    expect(res.statusCode).toBe(401);
  });

  it("operador pode criar item/entrada/saida", async () => {
    await seedUser({ email: "op-stock@x.com", senha: "senha12345", role: "operador" });
    const opCookie = await login(app, "op-stock@x.com", "senha12345");

    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const setor = await seedSetor("almoxarifado");
    const funcionario = await seedFuncionario({ nome: "Fulano", cargo: "Aux", setorId: setor.id });

    const createItem = await app.inject({
      method: "POST",
      url: "/api/v1/items",
      headers: { cookie: opCookie },
      payload: {
        codigo: "ITM-AUTH1",
        descricao: "Item",
        categoriaId: categoria.id,
        depositoId: deposito.id,
      },
    });
    expect(createItem.statusCode).toBe(201);

    const itemId = createItem.json().item.id as string;

    const entrada = await app.inject({
      method: "POST",
      url: "/api/v1/entradas",
      headers: { cookie: opCookie },
      payload: { itemId, qtd: 5, valorUnit: 10 },
    });
    expect(entrada.statusCode).toBe(201);

    const saida = await app.inject({
      method: "POST",
      url: "/api/v1/saidas",
      headers: { cookie: opCookie },
      payload: { itemId, funcionarioId: funcionario.id, qtd: 1, valorUnit: 10 },
    });
    expect(saida.statusCode).toBe(201);
  });

  it("somente admin pode deletar item", async () => {
    await seedUser({ email: "op-del@x.com", senha: "senha12345", role: "operador" });
    const opCookie = await login(app, "op-del@x.com", "senha12345");
    const adminCookie = await loginAsAdmin(app);

    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const item = await seedItem({ codigo: "ITM-AUTH2", categoriaId: categoria.id, depositoId: deposito.id });

    const opRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/items/${item.id}`,
      headers: { cookie: opCookie },
    });
    expect(opRes.statusCode).toBe(403);

    const admRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/items/${item.id}`,
      headers: { cookie: adminCookie },
    });
    expect(admRes.statusCode).toBe(200);
  });
});
