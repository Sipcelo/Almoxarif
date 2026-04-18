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
let setorId: string;

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
  const setor = await seedSetor("diretoria");
  setorId = setor.id;
});

describe("Funcionarios — CRUD", () => {
  it("cria funcionário (201) com setor ativo", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/funcionarios",
      headers: { cookie: adminCookie },
      payload: { nome: "João", cargo: "Diretor", setorId },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.funcionario).toMatchObject({
      nome: "João",
      cargo: "Diretor",
      setorId,
      ativo: true,
    });
    expect(body.funcionario.setor).toMatchObject({ id: setorId, nome: "diretoria" });
  });

  it("lista funcionários (200)", async () => {
    await prisma.funcionario.create({
      data: { nome: "A", cargo: "X", setorId },
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/funcionarios",
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.funcionarios).toHaveLength(1);
    expect(body.meta).toMatchObject({ total: 1, page: 1 });
  });

  it("busca funcionário por id (200)", async () => {
    const f = await prisma.funcionario.create({
      data: { nome: "Maria", cargo: "Contador", setorId },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/funcionarios/${f.id}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().funcionario.id).toBe(f.id);
  });

  it("retorna 404 para id inexistente", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/funcionarios/00000000-0000-0000-0000-000000000000",
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("atualiza funcionário (200) registrando diff", async () => {
    const f = await prisma.funcionario.create({
      data: { nome: "Original", cargo: "Cargo1", setorId },
    });
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/funcionarios/${f.id}`,
      headers: { cookie: adminCookie },
      payload: { nome: "Novo", cargo: "Cargo2" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().funcionario).toMatchObject({ nome: "Novo", cargo: "Cargo2" });
    const log = await prisma.auditLog.findFirst({
      where: { action: "EMPLOYEE_UPDATED", target: f.id },
    });
    expect(log).toBeTruthy();
  });

  it("soft-delete (desativa e é idempotente)", async () => {
    const f = await prisma.funcionario.create({
      data: { nome: "Delete", cargo: "C", setorId },
    });
    const r1 = await app.inject({
      method: "DELETE",
      url: `/api/v1/funcionarios/${f.id}`,
      headers: { cookie: adminCookie },
    });
    expect(r1.statusCode).toBe(200);
    const after1 = await prisma.funcionario.findUnique({ where: { id: f.id } });
    expect(after1?.ativo).toBe(false);

    const r2 = await app.inject({
      method: "DELETE",
      url: `/api/v1/funcionarios/${f.id}`,
      headers: { cookie: adminCookie },
    });
    expect(r2.statusCode).toBe(200);
  });
});
