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
});

describe("Settings/Funcionarios — autorização", () => {
  it("401 sem cookie de sessão", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/settings/setores",
    });
    expect(res.statusCode).toBe(401);
  });

  it("operador pode listar mas não pode criar setor (403)", async () => {
    await seedUser({ email: "op@x.com", senha: "senha12345", role: "operador" });
    const opCookie = await login(app, "op@x.com", "senha12345");

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/settings/setores",
      headers: { cookie: opCookie },
    });
    expect(listRes.statusCode).toBe(200);

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/settings/setores",
      headers: { cookie: opCookie },
      payload: { nome: "novo" },
    });
    expect(createRes.statusCode).toBe(403);
  });

  it("operador não pode criar funcionário (403)", async () => {
    await seedUser({ email: "op2@x.com", senha: "senha12345", role: "operador" });
    const opCookie = await login(app, "op2@x.com", "senha12345");
    const adminCookie = await loginAsAdmin(app);
    const s = await seedSetor("setor1");

    // admin pode:
    const admOk = await app.inject({
      method: "POST",
      url: "/api/v1/funcionarios",
      headers: { cookie: adminCookie },
      payload: { nome: "Funcionário Um", cargo: "Cargo", setorId: s.id },
    });
    expect(admOk.statusCode).toBe(201);

    // operador não pode:
    const opFail = await app.inject({
      method: "POST",
      url: "/api/v1/funcionarios",
      headers: { cookie: opCookie },
      payload: { nome: "Funcionário Dois", cargo: "Cargo", setorId: s.id },
    });
    expect(opFail.statusCode).toBe(403);
  });
});
