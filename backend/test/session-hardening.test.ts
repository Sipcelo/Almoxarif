import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  loginAsAdmin,
  prisma,
  extractSid,
  buildCookie,
  ADMIN_EMAIL,
  ADMIN_SENHA,
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

describe("Session hardening — fixation, cookies anômalos, replay", () => {
  it("session fixation: SID pré-existente é descartado; login emite SID novo", async () => {
    const fakeSid = "00000000-0000-0000-0000-000000000000";
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { cookie: buildCookie(fakeSid) },
      payload: { email: ADMIN_EMAIL, senha: ADMIN_SENHA },
    });
    expect(res.statusCode).toBe(200);
    const newSid = extractSid(res.headers["set-cookie"]);
    expect(newSid).toBeTruthy();
    expect(newSid).not.toBe(fakeSid);

    // fakeSid não virou session válida
    const sess = await prisma.session.findUnique({ where: { id: fakeSid } });
    expect(sess).toBeNull();
  });

  it("SID arbitrário em rota protegida → 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: buildCookie("11111111-1111-1111-1111-111111111111") },
    });
    expect(res.statusCode).toBe(401);
  });

  it("cookie vazio → 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: "almox_sid=" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("cookie não-UUID → 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: "almox_sid=not-a-valid-uuid" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("cookie anômalo (string longa) → 401", async () => {
    const huge = "a".repeat(4096);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: `almox_sid=${huge}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it("replay de cookie após logout → 401", async () => {
    const cookie = await loginAsAdmin(app);
    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie },
    });
    expect(logout.statusCode).toBe(200);

    const replay = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie },
    });
    expect(replay.statusCode).toBe(401);
  });

  it("sessão expirada no DB → 401 + session removida do banco", async () => {
    const cookie = await loginAsAdmin(app);
    const sid = /almox_sid=([^;]+)/.exec(cookie)?.[1] as string;

    // força expiração
    await prisma.session.update({
      where: { id: sid },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(401);

    const after = await prisma.session.findUnique({ where: { id: sid } });
    expect(after).toBeNull();
  });

  it("sliding expiration mantém regressão: expiresAt é renovado em request válido", async () => {
    const cookie = await loginAsAdmin(app);
    const sid = /almox_sid=([^;]+)/.exec(cookie)?.[1] as string;
    const before = await prisma.session.findUnique({ where: { id: sid } });

    await new Promise((r) => setTimeout(r, 20));

    await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie },
    });

    const after = await prisma.session.findUnique({ where: { id: sid } });
    expect(after!.expiresAt.getTime()).toBeGreaterThan(before!.expiresAt.getTime());
  });
});
