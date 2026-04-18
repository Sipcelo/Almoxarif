import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  seedCategoria,
  seedDeposito,
  seedSetor,
  seedFuncionario,
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

describe("Saidas", () => {
  it("saida valida decrementa saldo", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const setor = await seedSetor("almoxarifado");
    const funcionario = await seedFuncionario({ nome: "Fulano", cargo: "Aux", setorId: setor.id });
    const item = await seedItem({ codigo: "ITM-S1", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 10 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/saidas",
      headers: { cookie: adminCookie },
      payload: { itemId: item.id, funcionarioId: funcionario.id, qtd: 4, valorUnit: 10 },
    });

    expect(res.statusCode).toBe(201);
    expect(await getItemSaldo(item.id)).toBe(6);
  });

  it("saldo insuficiente -> 409", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const setor = await seedSetor("almoxarifado");
    const funcionario = await seedFuncionario({ nome: "Fulano", cargo: "Aux", setorId: setor.id });
    const item = await seedItem({ codigo: "ITM-S2", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 1 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/saidas",
      headers: { cookie: adminCookie },
      payload: { itemId: item.id, funcionarioId: funcionario.id, qtd: 2, valorUnit: 10 },
    });

    expect(res.statusCode).toBe(409);
    expect(await getItemSaldo(item.id)).toBe(1);
  });

  it("funcionario inexistente -> 404", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const item = await seedItem({ codigo: "ITM-S3", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 5 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/saidas",
      headers: { cookie: adminCookie },
      payload: {
        itemId: item.id,
        funcionarioId: "11111111-1111-1111-1111-111111111111",
        qtd: 1,
        valorUnit: 10,
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it("funcionario inativo -> 409", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const setor = await seedSetor("almoxarifado");
    const funcionario = await seedFuncionario({ nome: "Fulano", cargo: "Aux", setorId: setor.id, ativo: false });
    const item = await seedItem({ codigo: "ITM-S4", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 5 });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/saidas",
      headers: { cookie: adminCookie },
      payload: { itemId: item.id, funcionarioId: funcionario.id, qtd: 1, valorUnit: 10 },
    });

    expect(res.statusCode).toBe(409);
  });
});
