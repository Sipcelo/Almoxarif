import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { buildApp } from "../src/app/server";
import {
  cleanDatabase,
  seedUser,
  ADMIN_EMAIL,
  ADMIN_SENHA,
  seedAdmin,
  prisma,
  extractSid,
} from "./helpers";

/**
 * Suite isolada: rebuild app com janela de rate-limit curta para
 * testar threshold/cooldown sem depender da env global.
 */

const ORIGINAL_MAX = process.env.LOGIN_RATE_LIMIT_MAX;
const ORIGINAL_WINDOW = process.env.LOGIN_RATE_LIMIT_WINDOW_MS;

let app: FastifyInstance;

beforeAll(async () => {
  process.env.LOGIN_RATE_LIMIT_MAX = "3";
  process.env.LOGIN_RATE_LIMIT_WINDOW_MS = "800";
  app = await buildApp();
  await app.ready();
});

// Cada teste usa um IP distinto para escapar do bucket do rate-limit.
let ipCounter = 2;
function nextIp(): string {
  ipCounter += 1;
  return `10.0.0.${ipCounter}`;
}

afterAll(async () => {
  await app.close();
  process.env.LOGIN_RATE_LIMIT_MAX = ORIGINAL_MAX;
  process.env.LOGIN_RATE_LIMIT_WINDOW_MS = ORIGINAL_WINDOW;
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase();
  await seedAdmin();
});

async function attemptLogin(email: string, senha: string, ip?: string) {
  return app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, senha },
    remoteAddress: ip ?? nextIp(),
  });
}

describe("Auth hardening — CA-A4 + rate-limit cooldown", () => {
  it("usuário inativo → 401 com mensagem genérica", async () => {
    const hash = await bcrypt.hash("senha12345", 10);
    await prisma.user.create({
      data: {
        nome: "Inativo",
        email: "inativo@rodoviariapel.com",
        senha: hash,
        role: "operador",
        ativo: false,
      },
    });
    const res = await attemptLogin("inativo@rodoviariapel.com", "senha12345");
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe("Credenciais inválidas");
  });

  it("mensagens indistinguíveis entre inativo, inexistente e senha errada", async () => {
    const hash = await bcrypt.hash("senha12345", 10);
    await prisma.user.create({
      data: {
        nome: "I",
        email: "x@x.com",
        senha: hash,
        role: "operador",
        ativo: false,
      },
    });

    const r1 = await attemptLogin("x@x.com", "senha12345"); // inativo
    const r2 = await attemptLogin("naoexiste@x.com", "senha12345"); // inexistente
    const r3 = await attemptLogin(ADMIN_EMAIL, "senhaerrada1"); // senha errada

    expect(r1.statusCode).toBe(401);
    expect(r2.statusCode).toBe(401);
    expect(r3.statusCode).toBe(401);
    const m1 = r1.json().error.message;
    const m2 = r2.json().error.message;
    const m3 = r3.json().error.message;
    expect(m1).toBe(m2);
    expect(m2).toBe(m3);
  });

  it("login em usuário inativo não cria Session nem log de sucesso", async () => {
    const hash = await bcrypt.hash("senha12345", 10);
    const u = await prisma.user.create({
      data: {
        nome: "I",
        email: "inat2@x.com",
        senha: hash,
        role: "operador",
        ativo: false,
      },
    });
    const res = await attemptLogin("inat2@x.com", "senha12345");
    expect(res.statusCode).toBe(401);
    expect(extractSid(res.headers["set-cookie"])).toBeNull();

    const sessions = await prisma.session.findMany({ where: { userId: u.id } });
    expect(sessions).toHaveLength(0);

    const loginOK = await prisma.auditLog.findFirst({
      where: { action: "LOGIN", userId: u.id },
    });
    expect(loginOK).toBeNull();

    const failed = await prisma.auditLog.findFirst({
      where: { action: "LOGIN_FAILED", target: "inat2@x.com" },
    });
    expect(failed).toBeTruthy();
  });

  it("falhas abaixo do threshold não bloqueiam login válido subsequente", async () => {
    const ip = nextIp();
    const r1 = await attemptLogin(ADMIN_EMAIL, "errada1", ip);
    const r2 = await attemptLogin(ADMIN_EMAIL, "errada2", ip);
    expect(r1.statusCode).toBe(401);
    expect(r2.statusCode).toBe(401);

    const ok = await attemptLogin(ADMIN_EMAIL, ADMIN_SENHA, ip);
    expect(ok.statusCode).toBe(200);
  });

  it("exceder rate-limit threshold → 429; após cooldown → 200", async () => {
    const ip = nextIp();
    await attemptLogin(ADMIN_EMAIL, "x1", ip);
    await attemptLogin(ADMIN_EMAIL, "x2", ip);
    await attemptLogin(ADMIN_EMAIL, "x3", ip);
    const blocked = await attemptLogin(ADMIN_EMAIL, "x4", ip);
    expect(blocked.statusCode).toBe(429);

    await new Promise((r) => setTimeout(r, 1100));

    const ok = await attemptLogin(ADMIN_EMAIL, ADMIN_SENHA, ip);
    expect(ok.statusCode).toBe(200);
  });
});

// keep seedUser imported (used in helpers setup elsewhere)
void seedUser;
