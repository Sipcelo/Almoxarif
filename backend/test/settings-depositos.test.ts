import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  seedDeposito,
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

describe("Settings — Depositos", () => {
  it("cria deposito com nome normalizado (Title Case)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/depositos",
      headers: { cookie: adminCookie },
      payload: { nome: "  galpão central  " },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().deposito.nome).toBe("Galpão Central");
  });

  it("409 em nome duplicado", async () => {
    await seedDeposito("Anexo");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/depositos",
      headers: { cookie: adminCookie },
      payload: { nome: "ANEXO" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("atualiza e reativa deposito", async () => {
    const d = await seedDeposito("inativo", false);
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/settings/depositos/${d.id}`,
      headers: { cookie: adminCookie },
      payload: { ativo: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().deposito.ativo).toBe(true);
  });

  it("filtra por ativo=false", async () => {
    await seedDeposito("a", true);
    await seedDeposito("b", false);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/settings/depositos?ativo=false",
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().meta.total).toBe(1);
  });
});
