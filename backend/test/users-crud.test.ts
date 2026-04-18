import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  loginAsAdmin,
  prisma,
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

describe("Users — CRUD", () => {
  it("cria novo usuário (201 + senha ausente no body)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: { cookie: adminCookie },
      payload: {
        nome: "Novo Usuário",
        email: "novo@rodoviariapel.com",
        senha: "senha12345",
        role: "operador",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user).toMatchObject({
      email: "novo@rodoviariapel.com",
      role: "operador",
      ativo: true,
    });
    expect(JSON.stringify(body).includes("senha")).toBe(false);
  });

  it("atualiza role do usuário (200)", async () => {
    const user = await prisma.user.findUnique({
      where: { email: "novo@rodoviariapel.com" },
    });
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/users/${user!.id}`,
      headers: { cookie: adminCookie },
      payload: { role: "gerente" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.role).toBe("gerente");
  });

  it("soft delete via ativo=false (sem deletedAt)", async () => {
    const user = await prisma.user.findUnique({
      where: { email: "novo@rodoviariapel.com" },
    });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/users/${user!.id}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: user!.id } });
    expect(after!.ativo).toBe(false);
    // @ts-expect-error — deletedAt não deve existir no tipo
    expect(after.deletedAt).toBeUndefined();
  });

  it("DELETE em usuário já inativo é idempotente (200)", async () => {
    const user = await prisma.user.findUnique({
      where: { email: "novo@rodoviariapel.com" },
    });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/users/${user!.id}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
  });

  it("GET /users retorna lista sem campo senha", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/users",
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.users)).toBe(true);
    expect(JSON.stringify(body).includes("senha")).toBe(false);
  });

  it("GET /users/:id retorna user sem campo senha", async () => {
    const user = await prisma.user.findUnique({
      where: { email: "novo@rodoviariapel.com" },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/users/${user!.id}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.json()).includes("senha")).toBe(false);
  });
});
