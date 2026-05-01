import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  seedSetor,
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

describe("Settings — Setores", () => {
  it("cria setor com nome normalizado (Title Case)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/setores",
      headers: { cookie: adminCookie },
      payload: { nome: "  diretoria  " },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().setor.nome).toBe("Diretoria");
  });

  it("409 em nome duplicado (case-insensitive)", async () => {
    await seedSetor("Financeiro");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/setores",
      headers: { cookie: adminCookie },
      payload: { nome: "FINANCEIRO" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("atualiza nome do setor (200)", async () => {
    const s = await seedSetor("Antigo");
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/settings/setores/${s.id}`,
      headers: { cookie: adminCookie },
      payload: { nome: "novo setor" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().setor.nome).toBe("Novo Setor");
  });

  it("preserva acronimos (EPI fica EPI, nao Epi)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/setores",
      headers: { cookie: adminCookie },
      payload: { nome: "EPI" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().setor.nome).toBe("EPI");
  });

  it("capitaliza palavras separadas por barra", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/setores",
      headers: { cookie: adminCookie },
      payload: { nome: "copa/cozinha" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().setor.nome).toBe("Copa/Cozinha");
  });

  it("409 ao desativar setor com funcionários ativos", async () => {
    const s = await seedSetor("ocupado");
    await prisma.funcionario.create({
      data: { nome: "Func", cargo: "C", setorId: s.id },
    });
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/settings/setores/${s.id}`,
      headers: { cookie: adminCookie },
      payload: { ativo: false },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("CONFLICT");
  });

  it("permite desativar quando todos funcionários já estão inativos", async () => {
    const s = await seedSetor("liberavel");
    await prisma.funcionario.create({
      data: { nome: "Func", cargo: "C", setorId: s.id, ativo: false },
    });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/settings/setores/${s.id}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const after = await prisma.setor.findUnique({ where: { id: s.id } });
    expect(after?.ativo).toBe(false);
  });

  it("lista setores com paginação", async () => {
    for (let i = 0; i < 3; i++) await seedSetor(`s${i}`);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/settings/setores",
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.setores).toHaveLength(3);
    expect(body.meta.total).toBe(3);
  });
});
