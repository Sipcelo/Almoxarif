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

describe("Stock audit", () => {
  it("gera logs de sucesso para item/entrada/saida/ajuste", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const setor = await seedSetor("almoxarifado");
    const funcionario = await seedFuncionario({ nome: "Fulano", cargo: "Aux", setorId: setor.id });

    const createItem = await app.inject({
      method: "POST",
      url: "/api/v1/items",
      headers: { cookie: adminCookie },
      payload: { codigo: "ITM-LG1", descricao: "Item", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 5 },
    });
    const itemId = createItem.json().item.id as string;

    await app.inject({
      method: "POST",
      url: "/api/v1/entradas",
      headers: { cookie: adminCookie },
      payload: { itemId, qtd: 3, valorUnit: 10 },
    });

    await app.inject({
      method: "POST",
      url: "/api/v1/saidas",
      headers: { cookie: adminCookie },
      payload: { itemId, funcionarioId: funcionario.id, qtd: 2, valorUnit: 10 },
    });

    await app.inject({
      method: "POST",
      url: "/api/v1/ajustes",
      headers: { cookie: adminCookie },
      payload: { itemId, qtdNova: 4, motivo: "Correcao de contagem" },
    });

    const actions = await prisma.auditLog.findMany({ orderBy: { timestamp: "asc" } });
    const names = actions.map((a) => a.action);
    expect(names).toContain("ITEM_CREATED");
    expect(names).toContain("ENTRADA_CREATED");
    expect(names).toContain("SAIDA_CREATED");
    expect(names).toContain("AJUSTE_CREATED");
  });

  it("nao cria log de sucesso em operacao rejeitada", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const setor = await seedSetor("almoxarifado");
    const funcionario = await seedFuncionario({ nome: "Fulano", cargo: "Aux", setorId: setor.id });
    const item = await seedItem({ codigo: "ITM-LG2", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 1 });

    await app.inject({
      method: "POST",
      url: "/api/v1/saidas",
      headers: { cookie: adminCookie },
      payload: { itemId: item.id, funcionarioId: funcionario.id, qtd: 2, valorUnit: 10 },
    });

    const saidaLogs = await prisma.auditLog.findMany({ where: { action: "SAIDA_CREATED" } });
    expect(saidaLogs).toHaveLength(0);
  });
});
