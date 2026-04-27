import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  seedUser,
  loginAsAdmin,
  login,
  prisma,
} from "./helpers";

let app: FastifyInstance;
let adminCookie: string;
let opCookie: string;

beforeAll(async () => {
  app = await createApp();
  await cleanDatabase();
  await seedAdmin();
  await seedUser({ email: "op@rodoviariapel.com", senha: "operador2026", role: "operador" });
  adminCookie = await loginAsAdmin(app);
  opCookie = await login(app, "op@rodoviariapel.com", "operador2026");

  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "admin@rodoviariapel.com" } });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: adminUser.id,
        action: "LOGIN",
        target: adminUser.id,
        ipAddress: "127.0.0.1",
        timestamp: new Date("2026-04-20T10:00:00.000Z"),
      },
      {
        userId: null,
        action: "LOGIN_FAILED",
        target: "x@x.com",
        ipAddress: "127.0.0.1",
        timestamp: new Date("2026-04-21T10:00:00.000Z"),
      },
      {
        userId: adminUser.id,
        action: "USER_CREATED",
        target: "some-uuid",
        details: JSON.stringify({ nome: "Test" }),
        ipAddress: "127.0.0.1",
        timestamp: new Date("2026-04-22T10:00:00.000Z"),
      },
    ],
  });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("GET /api/v1/audit", () => {
  it("sem cookie -> 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/audit" });
    expect(res.statusCode).toBe(401);
  });

  it("operador -> 403 FORBIDDEN", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/audit", headers: { cookie: opCookie } });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error.code).toBe("FORBIDDEN");
  });

  it("admin -> 200 com logs e meta", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/audit", headers: { cookie: adminCookie } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.logs)).toBe(true);
    expect(body.meta).toHaveProperty("total");
    expect(body.meta).toHaveProperty("page", 1);
    expect(body.meta).toHaveProperty("limit", 20);
    expect(body.meta).toHaveProperty("totalPages");
  });

  it("meta.total reflete contagem real no banco", async () => {
    const dbTotal = await prisma.auditLog.count();
    const res = await app.inject({ method: "GET", url: "/api/v1/audit", headers: { cookie: adminCookie } });
    expect(JSON.parse(res.body).meta.total).toBe(dbTotal);
  });

  it("filtro action=LOGIN retorna so registros LOGIN", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/audit?action=LOGIN", headers: { cookie: adminCookie } });
    const { logs } = JSON.parse(res.body);
    expect(logs.length).toBeGreaterThan(0);
    logs.forEach((l: { action: string }) => expect(l.action).toBe("LOGIN"));
  });

  it("paginacao: page=1&limit=1 retorna 1 log e totalPages = total", async () => {
    const dbTotal = await prisma.auditLog.count();
    const res = await app.inject({ method: "GET", url: "/api/v1/audit?page=1&limit=1", headers: { cookie: adminCookie } });
    const body = JSON.parse(res.body);
    expect(body.logs).toHaveLength(1);
    expect(body.meta.limit).toBe(1);
    expect(body.meta.totalPages).toBe(dbTotal);
  });

  it("dataInicio > dataFim -> 400 VALIDATION_ERROR", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/audit?dataInicio=2030-01-01&dataFim=2026-01-01",
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("VALIDATION_ERROR");
  });

  it("log com userId=null tem user=null", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/audit?action=LOGIN_FAILED", headers: { cookie: adminCookie } });
    const { logs } = JSON.parse(res.body);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].user).toBeNull();
  });

  it("log com details JSON valido retorna objeto parseado", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/audit?action=USER_CREATED", headers: { cookie: adminCookie } });
    const { logs } = JSON.parse(res.body);
    expect(logs.length).toBeGreaterThan(0);
    expect(typeof logs[0].details).toBe("object");
    expect(logs[0].details).not.toBeNull();
  });

  it("log com details=null retorna details=null", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/audit?action=LOGIN_FAILED", headers: { cookie: adminCookie } });
    const { logs } = JSON.parse(res.body);
    expect(logs[0].details).toBeNull();
  });

  it("userId inexistente retorna logs vazio e total=0", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/audit?userId=00000000-0000-0000-0000-000000000000",
      headers: { cookie: adminCookie },
    });
    const body = JSON.parse(res.body);
    expect(body.logs).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });
});
