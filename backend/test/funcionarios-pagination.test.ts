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
  const s = await seedSetor("geral");
  setorId = s.id;
  for (let i = 0; i < 25; i++) {
    await prisma.funcionario.create({
      data: { nome: `F${String(i).padStart(2, "0")}`, cargo: "c", setorId },
    });
  }
});

describe("Funcionarios — paginação e filtros", () => {
  it("shape padrão com meta completo", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/funcionarios",
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meta).toMatchObject({ total: 25, page: 1, limit: 20, totalPages: 2 });
    expect(body.funcionarios).toHaveLength(20);
  });

  it("filtro por setorId", async () => {
    const outro = await seedSetor("outro");
    await prisma.funcionario.create({
      data: { nome: "X", cargo: "Y", setorId: outro.id },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/funcionarios?setorId=${outro.id}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().meta.total).toBe(1);
  });

  it("limit > 100 → 400", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/funcionarios?limit=200",
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(400);
  });
});
