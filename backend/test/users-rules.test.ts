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
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("Users — regras de negócio (§5.1, §5.2)", () => {
  it("§5.1 CA-U6 — admin não pode se auto-desativar", async () => {
    await cleanDatabase();
    await seedAdmin();
    adminCookie = await loginAsAdmin(app);
    const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/users/${admin!.id}`,
      headers: { cookie: adminCookie },
      payload: { ativo: false },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("CONFLICT");
    expect(res.json().error.message).toContain("si mesmo");
  });

  it("§5.1 — admin não pode se auto-rebaixar", async () => {
    const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/users/${admin!.id}`,
      headers: { cookie: adminCookie },
      payload: { role: "operador" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("CONFLICT");
  });

  it("§5.2 CA-U7 — último admin protegido em DELETE", async () => {
    await cleanDatabase();
    await seedAdmin();
    adminCookie = await loginAsAdmin(app);
    const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/users/${admin!.id}`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("CONFLICT");
  });

  it("§5.2 variante — com outro admin ativo, admin pode desativar outro admin", async () => {
    // cria segundo admin
    await app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: { cookie: adminCookie },
      payload: {
        nome: "Admin 2",
        email: "admin2@rodoviariapel.com",
        senha: "senha12345",
        role: "admin",
      },
    });
    const other = await prisma.user.findUnique({
      where: { email: "admin2@rodoviariapel.com" },
    });
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/users/${other!.id}`,
      headers: { cookie: adminCookie },
      payload: { ativo: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.ativo).toBe(false);
  });

  it("§5.2 variante — rebaixar o último admin é bloqueado", async () => {
    await cleanDatabase();
    await seedAdmin();
    adminCookie = await loginAsAdmin(app);
    // cria user secundário para logar como outro admin e tentar rebaixar o primeiro
    await prisma.user.create({
      data: {
        nome: "Segundo",
        email: "seg@rodoviariapel.com",
        senha: "$2a$10$abcdefghijklmnopqrstuv", // hash fake, não vamos logar
        role: "operador",
        ativo: true,
      },
    });
    const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    // tentar mudar role do próprio admin (também cai em auto-ação)
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/users/${admin!.id}`,
      headers: { cookie: adminCookie },
      payload: { role: "operador" },
    });
    expect(res.statusCode).toBe(409);
  });
});
