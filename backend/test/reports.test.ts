import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
  seedItem,
  loginAsAdmin,
  login,
  prisma,
} from "./helpers";

let app: FastifyInstance;
let adminCookie: string;
let opCookie: string;
let itemOkId: string;
let itemBaixoId: string;

beforeAll(async () => {
  app = await createApp();
  await cleanDatabase();
  await seedAdmin();
  await seedUser({ email: "op@rodoviariapel.com", senha: "operador2026", role: "operador" });
  adminCookie = await loginAsAdmin(app);
  opCookie = await login(app, "op@rodoviariapel.com", "operador2026");

  const categoria = await seedCategoria("geral");
  const deposito = await seedDeposito("principal");
  const setor = await seedSetor("almoxarifado");
  const func = await seedFuncionario({ nome: "Carlos Silva", cargo: "Aux. Almox.", setorId: setor.id });

  // ok: qtd=50 >= min=10 | baixo: qtd=3 < min=10 | zero: qtd=0 < min=5
  const itemOk = await seedItem({ codigo: "EA001", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 50, minimo: 10, valorAtual: 10 });
  const itemBaixo = await seedItem({ codigo: "LH001", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 3, minimo: 10, valorAtual: 5 });
  await seedItem({ codigo: "MG001", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 0, minimo: 5, valorAtual: 20 });
  itemOkId = itemOk.id;
  itemBaixoId = itemBaixo.id;

  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "admin@rodoviariapel.com" } });

  await prisma.entrada.create({
    data: { itemId: itemOkId, qtd: 10, valorUnit: 10, data: new Date(), responsavelUserId: adminUser.id },
  });

  await prisma.saida.create({
    data: {
      itemId: itemOkId,
      qtd: 5,
      valorUnit: 10,
      data: new Date(),
      funcionarioId: func.id,
      setorSnapshotId: setor.id,
      setorSnapshotNome: setor.nome,
      responsavelUserId: adminUser.id,
    },
  });

  await prisma.ajuste.create({
    data: { itemId: itemBaixoId, qtdAnterior: 5, qtdNova: 3, motivo: "Recontagem", responsavelUserId: adminUser.id },
  });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("GET /api/v1/reports/metricas", () => {
  it("sem cookie -> 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/metricas" });
    expect(res.statusCode).toBe(401);
  });

  it("periodo=0 -> 400 VALIDATION_ERROR", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/metricas?periodo=0", headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("periodo=400 -> 400 VALIDATION_ERROR", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/metricas?periodo=400", headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("operador -> 200 com estrutura correta", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/metricas?periodo=30", headers: { cookie: opCookie } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("periodo", 30);
    expect(body).toHaveProperty("corte");
    expect(body.estoque).toHaveProperty("totalItens");
    expect(body.estoque).toHaveProperty("totalQtd");
    expect(body.estoque).toHaveProperty("totalValor");
    expect(body).toHaveProperty("entradas");
    expect(body).toHaveProperty("saidas");
    expect(body).toHaveProperty("itensCriticos");
    expect(Array.isArray(body.itensCriticos)).toBe(true);
  });

  it("estoque.totalItens = 3", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/metricas", headers: { cookie: adminCookie } });
    expect(JSON.parse(res.body).estoque.totalItens).toBe(3);
  });

  it("itensCriticos contem exatamente LH001 e MG001", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/metricas", headers: { cookie: adminCookie } });
    const { itensCriticos } = JSON.parse(res.body);
    expect(itensCriticos).toHaveLength(2);
    const codigos: string[] = itensCriticos.map((i: { codigo: string }) => i.codigo).sort();
    expect(codigos).toEqual(["LH001", "MG001"]);
  });

  it("itensCriticos nao expoe campo obs", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/metricas", headers: { cookie: adminCookie } });
    const { itensCriticos } = JSON.parse(res.body);
    expect(itensCriticos[0]).not.toHaveProperty("obs");
  });
});

describe("GET /api/v1/reports/movimentacoes", () => {
  it("sem cookie -> 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/movimentacoes" });
    expect(res.statusCode).toBe(401);
  });

  it("periodo=0 -> 400", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/movimentacoes?periodo=0", headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(400);
  });

  it("200 com entradas, saidas e ajustes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/movimentacoes?periodo=30", headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.entradas)).toBe(true);
    expect(Array.isArray(body.saidas)).toBe(true);
    expect(Array.isArray(body.ajustes)).toBe(true);
    expect(body.entradas.length).toBeGreaterThanOrEqual(1);
    expect(body.saidas.length).toBeGreaterThanOrEqual(1);
    expect(body.ajustes.length).toBeGreaterThanOrEqual(1);
  });

  it("entradas[0] tem responsavelNome como string", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/movimentacoes?periodo=30", headers: { cookie: adminCookie } });
    const { entradas } = JSON.parse(res.body);
    expect(entradas[0]).toHaveProperty("responsavelNome");
    expect(typeof entradas[0].responsavelNome).toBe("string");
  });

  it("saidas[0] tem funcionarioNome e responsavelNome", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/movimentacoes?periodo=30", headers: { cookie: adminCookie } });
    const { saidas } = JSON.parse(res.body);
    expect(saidas[0]).toHaveProperty("funcionarioNome");
    expect(saidas[0]).toHaveProperty("responsavelNome");
  });

  it("ajustes[0] tem responsavelNome como string", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/movimentacoes?periodo=30", headers: { cookie: adminCookie } });
    const { ajustes } = JSON.parse(res.body);
    expect(ajustes[0]).toHaveProperty("responsavelNome");
    expect(typeof ajustes[0].responsavelNome).toBe("string");
  });
});

describe("GET /api/v1/reports/por-setor", () => {
  it("sem cookie -> 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/por-setor" });
    expect(res.statusCode).toBe(401);
  });

  it("periodo=0 -> 400", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/por-setor?periodo=0", headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(400);
  });

  it("200 com setores array estruturado", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/por-setor?periodo=30", headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.setores)).toBe(true);
    expect(body.setores.length).toBeGreaterThanOrEqual(1);
    const s = body.setores[0];
    expect(s).toHaveProperty("setor");
    expect(s).toHaveProperty("count");
    expect(s).toHaveProperty("totalQtd");
    expect(s).toHaveProperty("totalValor");
    expect(Array.isArray(s.itens)).toBe(true);
    expect(Array.isArray(s.funcionarios)).toBe(true);
  });

  it("setor almoxarifado: count=1, totalQtd=5, totalValor=50.00", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/por-setor?periodo=30", headers: { cookie: adminCookie } });
    const { setores } = JSON.parse(res.body);
    const alm = setores.find((s: { setor: string }) => s.setor === "almoxarifado");
    expect(alm).toBeDefined();
    expect(alm.count).toBe(1);
    expect(alm.totalQtd).toBe(5);
    expect(alm.totalValor).toBe("50.00");
  });
});

describe("GET /api/v1/reports/estoque", () => {
  it("sem cookie -> 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/estoque" });
    expect(res.statusCode).toBe(401);
  });

  it("200 com snapshot completo", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/estoque", headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("geradoEm");
    expect(body).toHaveProperty("totalItens", 3);
    expect(Array.isArray(body.itens)).toBe(true);
    expect(body.itens).toHaveLength(3);
  });

  it("itens ordenados por codigo asc", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/estoque", headers: { cookie: adminCookie } });
    const { itens } = JSON.parse(res.body);
    expect(itens.map((i: { codigo: string }) => i.codigo)).toEqual(["EA001", "LH001", "MG001"]);
  });

  it("status ok/baixo/zero correto", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/estoque", headers: { cookie: adminCookie } });
    const { itens } = JSON.parse(res.body);
    const byCode: Record<string, { status: string }> = {};
    itens.forEach((i: { codigo: string; status: string }) => { byCode[i.codigo] = i; });
    expect(byCode["EA001"].status).toBe("ok");
    expect(byCode["LH001"].status).toBe("baixo");
    expect(byCode["MG001"].status).toBe("zero");
  });

  it("categoria e deposito como string", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/reports/estoque", headers: { cookie: adminCookie } });
    const { itens } = JSON.parse(res.body);
    expect(typeof itens[0].categoria).toBe("string");
    expect(typeof itens[0].deposito).toBe("string");
  });
});
