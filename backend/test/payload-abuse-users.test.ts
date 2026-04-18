import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  seedUser,
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

describe("Payload abuse — Users (mass assignment)", () => {
  it("POST /users com campos sensíveis → extras ignorados (.strip), persistência apenas dos contratuais", async () => {
    const hostil = {
      nome: "Teste Hostil",
      email: "hostil@x.com",
      senha: "senha12345",
      role: "operador",
      // campos sensíveis / não contratuais:
      id: "11111111-1111-1111-1111-111111111111",
      ativo: false,
      criadoEm: "1970-01-01T00:00:00.000Z",
      atualizadoEm: "1970-01-01T00:00:00.000Z",
      sessions: [{ id: "fake" }],
      auditLogs: [{ action: "HAX" }],
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: { cookie: adminCookie },
      payload: hostil,
    });
    expect(res.statusCode).toBe(201);
    const u = res.json().user;
    expect(u.id).not.toBe(hostil.id);
    expect(u.ativo).toBe(true); // default do schema, não o valor hostil

    const db = await prisma.user.findUnique({ where: { email: "hostil@x.com" } });
    expect(db).toBeTruthy();
    expect(db!.id).not.toBe(hostil.id);
    expect(db!.ativo).toBe(true);
    expect(db!.criadoEm.getTime()).toBeGreaterThan(new Date("2025-01-01").getTime());

    // nenhuma session/audit injetada
    const fakeSess = await prisma.session.findUnique({ where: { id: "fake" } }).catch(() => null);
    expect(fakeSess).toBeNull();
    const haxLog = await prisma.auditLog.findFirst({ where: { action: "HAX" } });
    expect(haxLog).toBeNull();
  });

  it("PUT /users/:id com campos sensíveis → só os permitidos persistem", async () => {
    const target = await seedUser({ email: "t@x.com", senha: "senha12345", role: "operador" });
    const before = await prisma.user.findUnique({ where: { id: target.id } });

    const hostil = {
      nome: "Novo Nome",
      // campos proibidos:
      id: "22222222-2222-2222-2222-222222222222",
      senha: "injetada123",
      criadoEm: "1970-01-01T00:00:00.000Z",
      atualizadoEm: "1970-01-01T00:00:00.000Z",
      email: "t@x.com", // igual, inofensivo
    };
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/users/${target.id}`,
      headers: { cookie: adminCookie },
      payload: hostil,
    });
    expect(res.statusCode).toBe(200);

    const after = await prisma.user.findUnique({ where: { id: target.id } });
    expect(after!.id).toBe(target.id);
    expect(after!.nome).toBe("Novo Nome");
    expect(after!.senha).toBe(before!.senha); // senha não foi alterada via PUT
    expect(after!.criadoEm.getTime()).toBe(before!.criadoEm.getTime());
  });

  it("PATCH /users/:id/password com campos extras irrelevantes → só novaSenha altera", async () => {
    const target = await seedUser({ email: "p@x.com", senha: "senha12345", role: "operador" });
    const before = await prisma.user.findUnique({ where: { id: target.id } });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/users/${target.id}/password`,
      headers: { cookie: adminCookie },
      payload: {
        novaSenha: "novaSenha123",
        role: "admin", // tentativa de auto-promoção via PATCH password
        ativo: false,
        id: "33333333-3333-3333-3333-333333333333",
      },
    });
    expect(res.statusCode).toBe(200);

    const after = await prisma.user.findUnique({ where: { id: target.id } });
    expect(after!.role).toBe(before!.role); // role não mudou
    expect(after!.ativo).toBe(before!.ativo);
    expect(after!.id).toBe(before!.id);
    expect(after!.senha).not.toBe(before!.senha); // senha mudou
  });

  it("payload hostil não burla regra do último admin", async () => {
    const admin = await prisma.user.findUnique({ where: { email: "admin@rodoviariapel.com" } });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/users/${admin!.id}`,
      headers: { cookie: adminCookie },
      payload: { force: true, override: true },
    });
    expect(res.statusCode).toBe(409);
    const still = await prisma.user.findUnique({ where: { id: admin!.id } });
    expect(still!.ativo).toBe(true);
  });

  it("operador não pode se auto-promover a admin via payload hostil em PUT", async () => {
    const op = await seedUser({ email: "opprom@x.com", senha: "senha12345", role: "operador" });
    const opCookie = await login(app, "opprom@x.com", "senha12345");

    // operador nem deveria chegar no handler — é bloqueado por requireRole(['admin'])
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/users/${op.id}`,
      headers: { cookie: opCookie },
      payload: { role: "admin" },
    });
    expect(res.statusCode).toBe(403);

    const after = await prisma.user.findUnique({ where: { id: op.id } });
    expect(after!.role).toBe("operador");
  });
});
