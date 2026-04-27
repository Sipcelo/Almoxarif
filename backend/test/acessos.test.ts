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

describe("Acessos", () => {
  it("admin cria acesso e gera audit log", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/acessos",
      headers: { cookie: adminCookie },
      payload: {
        nome: "Visitante Externo",
        tipo: "Entrada",
        hora: "08:45",
        data: "2026-04-18",
        cargo: "Tecnico",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().acesso).toMatchObject({
      nome: "Visitante Externo",
      tipo: "Entrada",
      hora: "08:45",
      data: "2026-04-18",
      cargo: "Tecnico",
    });

    const acessoId = res.json().acesso.id as string;
    const audit = await prisma.auditLog.findFirst({
      where: { action: "ACESSO_CREATED", target: acessoId },
    });
    expect(audit).toBeTruthy();
  });

  it("lista acessos com filtro por texto", async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@rodoviariapel.com" },
    });

    await prisma.acesso.createMany({
      data: [
        {
          nome: "Carlos Silva",
          tipo: "Entrada",
          hora: "09:00",
          data: new Date("2026-04-18T00:00:00.000Z"),
          cargo: "Motorista",
          responsavelUserId: admin.id,
        },
        {
          nome: "Marina Sousa",
          tipo: "Saida",
          hora: "10:30",
          data: new Date("2026-04-18T00:00:00.000Z"),
          cargo: "Supervisora",
          responsavelUserId: admin.id,
        },
      ],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/acessos?q=carlos",
      headers: { cookie: adminCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().acessos).toHaveLength(1);
    expect(res.json().acessos[0].nome).toBe("Carlos Silva");
    expect(res.json().meta.total).toBe(1);
  });

  it("sem sessao retorna 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/acessos",
    });
    expect(res.statusCode).toBe(401);
  });

  it("operador nao pode listar nem criar (403)", async () => {
    await seedUser({
      email: "op-acesso@rodoviariapel.com",
      senha: "senha12345",
      role: "operador",
      nome: "Operador Acesso",
    });
    const opCookie = await login(app, "op-acesso@rodoviariapel.com", "senha12345");

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/acessos",
      headers: { cookie: opCookie },
    });
    expect(listRes.statusCode).toBe(403);

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/acessos",
      headers: { cookie: opCookie },
      payload: {
        nome: "Teste",
        tipo: "Entrada",
        hora: "08:00",
        data: "2026-04-18",
      },
    });
    expect(createRes.statusCode).toBe(403);
  });

  it("hora invalida retorna 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/acessos",
      headers: { cookie: adminCookie },
      payload: {
        nome: "Teste Hora",
        tipo: "Entrada",
        hora: "99:99",
        data: "2026-04-18",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });
});
