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

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function reset() {
  await cleanDatabase();
  await seedAdmin();
  adminCookie = await loginAsAdmin(app);
}

describe("Invalidação de sessão (§5.5, §5.6, §5.7)", () => {
  it("§5.5 — sliding expiration: expires_at aumenta após request autenticado", async () => {
    await reset();
    const sid = adminCookie.replace("almox_sid=", "");
    const before = await prisma.session.findUnique({ where: { id: sid } });
    // força expires_at para 1h no passado-de-janela menor
    const manual = new Date(Date.now() + 1000);
    await prisma.session.update({ where: { id: sid }, data: { expiresAt: manual } });
    const lower = (await prisma.session.findUnique({ where: { id: sid } }))!.expiresAt;

    await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: adminCookie },
    });

    const after = await prisma.session.findUnique({ where: { id: sid } });
    expect(after!.expiresAt.getTime()).toBeGreaterThan(lower.getTime());
    expect(before).toBeTruthy();
  });

  it("§5.6 — desativar usuário invalida sessões e próximo request retorna 401", async () => {
    await reset();
    await seedUser({ email: "b@rodoviariapel.com", senha: "senha12345", role: "operador" });
    const bCookie = await login(app, "b@rodoviariapel.com", "senha12345");
    const b = await prisma.user.findUnique({ where: { email: "b@rodoviariapel.com" } });

    await app.inject({
      method: "PUT",
      url: `/api/v1/users/${b!.id}`,
      headers: { cookie: adminCookie },
      payload: { ativo: false },
    });

    const sessions = await prisma.session.findMany({ where: { userId: b!.id } });
    expect(sessions.length).toBe(0);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: bCookie },
    });
    expect(me.statusCode).toBe(401);
  });

  it("§5.7 — alterar senha invalida sessões do alvo", async () => {
    await reset();
    await seedUser({ email: "c@rodoviariapel.com", senha: "senha12345", role: "operador" });
    const cCookie = await login(app, "c@rodoviariapel.com", "senha12345");
    const c = await prisma.user.findUnique({ where: { email: "c@rodoviariapel.com" } });

    await app.inject({
      method: "PATCH",
      url: `/api/v1/users/${c!.id}/password`,
      headers: { cookie: adminCookie },
      payload: { novaSenha: "novasenha12345" },
    });

    const sessions = await prisma.session.findMany({ where: { userId: c!.id } });
    expect(sessions.length).toBe(0);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: cCookie },
    });
    expect(me.statusCode).toBe(401);
  });

  it("alterar role invalida sessões do alvo", async () => {
    await reset();
    await seedUser({ email: "d@rodoviariapel.com", senha: "senha12345", role: "operador" });
    const dCookie = await login(app, "d@rodoviariapel.com", "senha12345");
    const d = await prisma.user.findUnique({ where: { email: "d@rodoviariapel.com" } });

    await app.inject({
      method: "PUT",
      url: `/api/v1/users/${d!.id}`,
      headers: { cookie: adminCookie },
      payload: { role: "gerente" },
    });

    const sessions = await prisma.session.findMany({ where: { userId: d!.id } });
    expect(sessions.length).toBe(0);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: dCookie },
    });
    expect(me.statusCode).toBe(401);
  });
});
