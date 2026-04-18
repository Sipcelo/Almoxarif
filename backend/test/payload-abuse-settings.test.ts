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

describe("Payload abuse — Funcionarios/Settings", () => {
  it("POST /funcionarios com campos sensíveis → extras ignorados", async () => {
    const s = await seedSetor("diretoria");
    const hostil = {
      nome: "Funcionário Hostil",
      cargo: "Diretor",
      setorId: s.id,
      id: "99999999-9999-9999-9999-999999999999",
      ativo: false,
      criadoEm: "1970-01-01T00:00:00.000Z",
      setor: { id: "nested", nome: "nested" },
      auditLogs: [{ action: "HAX" }],
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/funcionarios",
      headers: { cookie: adminCookie },
      payload: hostil,
    });
    expect(res.statusCode).toBe(201);
    const f = res.json().funcionario;
    expect(f.id).not.toBe(hostil.id);
    expect(f.ativo).toBe(true);

    const db = await prisma.funcionario.findUnique({ where: { id: f.id } });
    expect(db!.ativo).toBe(true);
    expect(db!.setorId).toBe(s.id);
    const haxLog = await prisma.auditLog.findFirst({ where: { action: "HAX" } });
    expect(haxLog).toBeNull();
  });

  it("PUT /funcionarios/:id com setorId inexistente → 400 sem efeito lateral", async () => {
    const s = await seedSetor("origem");
    const f = await prisma.funcionario.create({
      data: { nome: "Ana", cargo: "Analista", setorId: s.id },
    });
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/funcionarios/${f.id}`,
      headers: { cookie: adminCookie },
      payload: { setorId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.statusCode).toBe(400);
    const after = await prisma.funcionario.findUnique({ where: { id: f.id } });
    expect(after!.setorId).toBe(s.id);
    const log = await prisma.auditLog.findFirst({
      where: { action: "EMPLOYEE_UPDATED", target: f.id },
    });
    expect(log).toBeNull();
  });

  it("PUT /funcionarios/:id com setorId inativo → 409 sem efeito lateral", async () => {
    const s = await seedSetor("origem");
    const inativo = await seedSetor("alvo-inativo", false);
    const f = await prisma.funcionario.create({
      data: { nome: "Ana", cargo: "Analista", setorId: s.id },
    });
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/funcionarios/${f.id}`,
      headers: { cookie: adminCookie },
      payload: { setorId: inativo.id },
    });
    expect(res.statusCode).toBe(409);
    const after = await prisma.funcionario.findUnique({ where: { id: f.id } });
    expect(after!.setorId).toBe(s.id);
  });

  it("POST /settings/setores com campos extras → extras ignorados", async () => {
    const hostil = {
      nome: "financeiro",
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      ativo: false,
      criadoEm: "1970-01-01T00:00:00.000Z",
      funcionarios: [{ id: "fake" }],
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/setores",
      headers: { cookie: adminCookie },
      payload: hostil,
    });
    expect(res.statusCode).toBe(201);
    const setor = res.json().setor;
    expect(setor.id).not.toBe(hostil.id);
    expect(setor.ativo).toBe(true);
    const db = await prisma.setor.findUnique({ where: { id: setor.id } });
    expect(db!.ativo).toBe(true);
  });

  it("POST /settings/categorias com campos extras → extras ignorados", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/categorias",
      headers: { cookie: adminCookie },
      payload: {
        nome: "ferramentas",
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        ativo: false,
        __proto__: { polluted: true },
      },
    });
    expect(res.statusCode).toBe(201);
    const c = res.json().categoria;
    expect(c.id).not.toBe("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    expect(c.ativo).toBe(true);
  });

  it("POST /settings/depositos com campos extras → extras ignorados", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/depositos",
      headers: { cookie: adminCookie },
      payload: {
        nome: "galpao-01",
        id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        ativo: false,
      },
    });
    expect(res.statusCode).toBe(201);
    const d = res.json().deposito;
    expect(d.id).not.toBe("cccccccc-cccc-cccc-cccc-cccccccccccc");
    expect(d.ativo).toBe(true);
  });
});
