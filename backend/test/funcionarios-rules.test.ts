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

describe("Funcionarios — regras de negócio", () => {
  it("400 quando setorId aponta para setor inexistente", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/funcionarios",
      headers: { cookie: adminCookie },
      payload: {
        nome: "João Silva",
        cargo: "Diretor",
        setorId: "00000000-0000-0000-0000-000000000000",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("409 quando setor existe mas está inativo", async () => {
    const s = await seedSetor("inativo", false);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/funcionarios",
      headers: { cookie: adminCookie },
      payload: { nome: "Maria", cargo: "Diretor", setorId: s.id },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("CONFLICT");
  });

  it("400 ao trocar setor para um inexistente no update", async () => {
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
  });

  it("validação exige pelo menos um campo no update", async () => {
    const s = await seedSetor("origem");
    const f = await prisma.funcionario.create({
      data: { nome: "Ana", cargo: "Analista", setorId: s.id },
    });
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/funcionarios/${f.id}`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
