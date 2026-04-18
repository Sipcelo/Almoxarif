import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  loginAsAdmin,
  prisma,
  ADMIN_EMAIL,
} from "./helpers";

let app: FastifyInstance;
let adminCookie: string;

beforeAll(async () => {
  app = await createApp();
  await cleanDatabase();
  await seedAdmin();
  adminCookie = await loginAsAdmin(app);
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("AuditLog", () => {
  it("USER_CREATED registrado com userId, target, details", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: { cookie: adminCookie },
      payload: {
        nome: "Audit User",
        email: "audit@rodoviariapel.com",
        senha: "senha12345",
        role: "operador",
      },
    });

    const logs = await prisma.auditLog.findMany({
      where: { action: "USER_CREATED" },
    });
    expect(logs.length).toBeGreaterThan(0);
    const last = logs[logs.length - 1];
    expect(last.userId).not.toBeNull();
    expect(last.target).not.toBeNull();
    expect(last.details).not.toBeNull();
  });

  it("LOGIN registrado após login bem-sucedido", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ADMIN_EMAIL, senha: "admin2026" },
    });
    const logs = await prisma.auditLog.findMany({ where: { action: "LOGIN" } });
    expect(logs.length).toBeGreaterThan(0);
  });

  it("LOGIN_FAILED registrado com target=email e userId nulo (CA-A10)", async () => {
    await prisma.auditLog.deleteMany({ where: { action: "LOGIN_FAILED" } });
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "inexistente@rodoviariapel.com", senha: "qualquer" },
    });
    const logs = await prisma.auditLog.findMany({
      where: { action: "LOGIN_FAILED" },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].userId).toBeNull();
    expect(logs[0].target).toBe("inexistente@rodoviariapel.com");
  });
});
