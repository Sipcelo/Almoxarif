import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FastifyInstance } from "fastify";
import {
  ADMIN_EMAIL,
  ADMIN_SENHA,
  cleanDatabase,
  createApp,
  getCsrfFor,
  loginAsAdmin,
  prisma,
  seedAdmin,
} from "./helpers";

describe("CSRF — double-submit token (PR-1 SDD-004)", () => {
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

  it("login 200 emite csrfToken no body e cookie almox_csrf", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ADMIN_EMAIL, senha: ADMIN_SENHA },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { csrfToken?: string };
    expect(body.csrfToken).toBeTruthy();
    expect(typeof body.csrfToken).toBe("string");

    const rawCookies = res.headers["set-cookie"];
    const cookies = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
    const csrfCookie = cookies.find((c) => c.startsWith("almox_csrf="));
    expect(csrfCookie).toBeDefined();
    expect(csrfCookie).not.toMatch(/HttpOnly/i);
  });

  it("GET /auth/me retorna csrfToken", async () => {
    const cookie = await loginAsAdmin(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { csrfToken?: string };
    expect(body.csrfToken).toBe(getCsrfFor(cookie));
  });

  it("POST autenticado sem header x-almox-csrf -> 403 CSRF_ERROR", async () => {
    const cookie = await loginAsAdmin(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/categorias",
      headers: { cookie, "x-almox-csrf": "" }, // explicito vazio suprime auto-inject
      payload: { nome: "sem-csrf" },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body) as { error?: { code?: string } };
    expect(body.error?.code).toBe("CSRF_ERROR");
  });

  it("POST autenticado com header x-almox-csrf invalido -> 403 CSRF_ERROR", async () => {
    const cookie = await loginAsAdmin(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/categorias",
      headers: { cookie, "x-almox-csrf": "token-errado" },
      payload: { nome: "csrf-invalido" },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body) as { error?: { code?: string } };
    expect(body.error?.code).toBe("CSRF_ERROR");
  });

  it("POST autenticado com header x-almox-csrf correto -> 201", async () => {
    const cookie = await loginAsAdmin(app);
    const csrf = getCsrfFor(cookie)!;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/categorias",
      headers: { cookie, "x-almox-csrf": csrf },
      payload: { nome: "csrf-ok" },
    });
    expect(res.statusCode).toBe(201);
  });

  it("GET autenticado nao exige x-almox-csrf", async () => {
    const cookie = await loginAsAdmin(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/settings/categorias",
      headers: { cookie, "x-almox-csrf": "" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("POST /auth/login nao exige x-almox-csrf (rota publica)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ADMIN_EMAIL, senha: ADMIN_SENHA },
    });
    expect(res.statusCode).toBe(200);
  });

  it("logout 200 limpa cookie almox_csrf", async () => {
    const cookie = await loginAsAdmin(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const rawCookies = res.headers["set-cookie"];
    const cookies = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
    const cleared = cookies.find((c) => c.startsWith("almox_csrf="));
    expect(cleared).toBeDefined();
    // clearCookie emite valor vazio ou Expires no passado
    expect(cleared).toMatch(/almox_csrf=;|Expires=Thu, 01 Jan 1970/i);
  });
});
