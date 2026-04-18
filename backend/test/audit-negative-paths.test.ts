import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  seedUser,
  seedSetor,
  login,
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

describe("AuditLog — caminhos rejeitados não produzem log de sucesso", () => {
  it("LOGIN_FAILED é registrado em login inválido", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "nao@existe.com", senha: "senha12345" },
    });
    const log = await prisma.auditLog.findFirst({
      where: { action: "LOGIN_FAILED", target: "nao@existe.com" },
    });
    expect(log).toBeTruthy();
  });

  it("rejeição por autorização (403) não cria USER_CREATED", async () => {
    await seedUser({ email: "op@x.com", senha: "senha12345", role: "operador" });
    const opCookie = await login(app, "op@x.com", "senha12345");

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: { cookie: opCookie },
      payload: {
        nome: "Nao Deve",
        email: "naodeve@x.com",
        senha: "senha12345",
        role: "operador",
      },
    });
    expect(res.statusCode).toBe(403);

    const created = await prisma.auditLog.findFirst({
      where: { action: "USER_CREATED" },
    });
    // só deve existir USER_CREATED se houve seed; como não há, deve ser null
    expect(created).toBeNull();

    const u = await prisma.user.findUnique({ where: { email: "naodeve@x.com" } });
    expect(u).toBeNull();
  });

  it("rejeição por validação (400) não cria EMPLOYEE_CREATED", async () => {
    const s = await seedSetor("setor-x");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/funcionarios",
      headers: { cookie: adminCookie },
      payload: { nome: "A", cargo: "", setorId: s.id }, // nome e cargo curtos → 400
    });
    expect(res.statusCode).toBe(400);
    const log = await prisma.auditLog.findFirst({
      where: { action: "EMPLOYEE_CREATED" },
    });
    expect(log).toBeNull();
  });

  it("rejeição por regra de negócio (409 setor inativo) não cria EMPLOYEE_CREATED", async () => {
    const s = await seedSetor("alvo", false);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/funcionarios",
      headers: { cookie: adminCookie },
      payload: { nome: "Teste", cargo: "Cargo", setorId: s.id },
    });
    expect(res.statusCode).toBe(409);
    const log = await prisma.auditLog.findFirst({
      where: { action: "EMPLOYEE_CREATED" },
    });
    expect(log).toBeNull();
  });

  it("auto-desativação bloqueada (409) não gera USER_UPDATED/USER_DEACTIVATED", async () => {
    const admin = await prisma.user.findUnique({
      where: { email: "admin@rodoviariapel.com" },
    });
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/users/${admin!.id}`,
      headers: { cookie: adminCookie },
      payload: { ativo: false },
    });
    expect(res.statusCode).toBe(409);

    const updated = await prisma.auditLog.findFirst({
      where: { action: "USER_UPDATED", target: admin!.id },
    });
    const deactivated = await prisma.auditLog.findFirst({
      where: { action: "USER_DEACTIVATED", target: admin!.id },
    });
    expect(updated).toBeNull();
    expect(deactivated).toBeNull();
  });

  it("desativar setor com vínculos ativos (409) não gera SETOR_UPDATED/DEACTIVATED", async () => {
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

    const updated = await prisma.auditLog.findFirst({
      where: { action: "SETOR_UPDATED", target: s.id },
    });
    const deactivated = await prisma.auditLog.findFirst({
      where: { action: "SETOR_DEACTIVATED", target: s.id },
    });
    expect(updated).toBeNull();
    expect(deactivated).toBeNull();
  });
});
