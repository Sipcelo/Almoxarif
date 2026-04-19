import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  prisma,
  ADMIN_EMAIL,
  ADMIN_SENHA,
  extractSid,
} from "./helpers";

let app: FastifyInstance;

beforeAll(async () => {
  app = await createApp();
  await cleanDatabase();
  await seedAdmin();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("Auth — login/logout/me", () => {
  it("login com credenciais válidas (200, cookie almox_sid, sem campo senha)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ADMIN_EMAIL, senha: ADMIN_SENHA },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toMatchObject({ email: ADMIN_EMAIL, role: "admin" });
    expect(JSON.stringify(body).includes("senha")).toBe(false);
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    expect(String(setCookie)).toMatch(/almox_sid=/);
    expect(String(setCookie)).toMatch(/HttpOnly/i);
  });

  it("login com credenciais inválidas (401 + CONFLICT/UNAUTHORIZED + PT)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ADMIN_EMAIL, senha: "errada" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toMatchObject({
      code: "UNAUTHORIZED",
      message: "Credenciais inválidas",
    });
  });

  it("/auth/me retorna user sem campo senha", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ADMIN_EMAIL, senha: ADMIN_SENHA },
    });
    const sid = extractSid(login.headers["set-cookie"]);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: `almox_sid=${sid}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.email).toBe(ADMIN_EMAIL);
    expect(JSON.stringify(body).includes("senha")).toBe(false);
  });

  it("logout deleta Session do banco e invalida cookie", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: ADMIN_EMAIL, senha: ADMIN_SENHA },
    });
    const sid = extractSid(login.headers["set-cookie"])!;
    const csrfToken = (JSON.parse(login.body) as { csrfToken: string }).csrfToken;
    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie: `almox_sid=${sid}`, "x-almox-csrf": csrfToken },
    });
    expect(logout.statusCode).toBe(200);
    expect(logout.json()).toMatchObject({ message: "Sessão encerrada" });

    const session = await prisma.session.findUnique({ where: { id: sid } });
    expect(session).toBeNull();

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: `almox_sid=${sid}` },
    });
    expect(me.statusCode).toBe(401);
  });
});
