import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "../src/app/server";

export const prisma = new PrismaClient();

export const ADMIN_EMAIL = "admin@rodoviariapel.com";
export const ADMIN_SENHA = "admin2026";
export const ADMIN_NOME = "Administrador";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const csrfByCookie = new Map<string, string>();

export function rememberCsrf(cookie: string, csrfToken: string): void {
  csrfByCookie.set(cookie, csrfToken);
}

export function getCsrfFor(cookie: string): string | undefined {
  return csrfByCookie.get(cookie);
}

export function authHeaders(cookie: string): Record<string, string> {
  const csrf = csrfByCookie.get(cookie);
  if (!csrf) throw new Error(`CSRF token nao registrado para cookie: ${cookie}`);
  return { cookie, "x-almox-csrf": csrf };
}

export async function createApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();

  // Auto-injeta x-almox-csrf em chamadas mutating com cookie conhecido,
  // desde que o teste nao tenha passado o header explicitamente (permite
  // testes negativos de CSRF definirem o header como "", null ou valor invalido).
  const appAny = app as unknown as { inject: (...args: unknown[]) => unknown };
  const originalInject = appAny.inject.bind(app);
  appAny.inject = (...args: unknown[]) => {
    const opts = args[0];
    if (opts && typeof opts === "object") {
      const o = opts as {
        method?: string;
        headers?: Record<string, unknown>;
      };
      const method = (o.method || "GET").toUpperCase();
      const headers = o.headers || {};
      const cookie = headers.cookie;
      if (
        MUTATING_METHODS.has(method) &&
        typeof cookie === "string" &&
        !("x-almox-csrf" in headers)
      ) {
        const csrf = csrfByCookie.get(cookie);
        if (csrf) {
          o.headers = { ...headers, "x-almox-csrf": csrf };
        }
      }
    }
    return originalInject(...args);
  };

  return app;
}

export async function cleanDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.ajuste.deleteMany();
  await prisma.saida.deleteMany();
  await prisma.entrada.deleteMany();
  await prisma.item.deleteMany();
  await prisma.session.deleteMany();
  await prisma.funcionario.deleteMany();
  await prisma.setor.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.deposito.deleteMany();
  await prisma.user.deleteMany();
}

export async function seedItem(opts: {
  codigo: string;
  descricao?: string;
  categoriaId: string;
  depositoId: string;
  quantidade?: number;
  minimo?: number;
  valorAtual?: number;
  obs?: string | null;
  ativo?: boolean;
}) {
  return prisma.item.create({
    data: {
      codigo: opts.codigo,
      descricao: opts.descricao ?? `Item ${opts.codigo}`,
      categoriaId: opts.categoriaId,
      depositoId: opts.depositoId,
      quantidade: opts.quantidade ?? 0,
      minimo: opts.minimo ?? 0,
      valorAtual: opts.valorAtual ?? 0,
      obs: opts.obs ?? null,
      ativo: opts.ativo ?? true,
    },
  });
}

export async function seedInventoryBase() {
  const categoria = await seedCategoria("geral");
  const deposito = await seedDeposito("principal");
  return { categoria, deposito };
}

export async function getItemSaldo(itemId: string) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw new Error(`Item nao encontrado: ${itemId}`);
  return item.quantidade;
}

export async function seedSetor(nome: string, ativo = true) {
  return prisma.setor.upsert({
    where: { nome },
    update: { ativo },
    create: { nome, ativo },
  });
}

export async function seedCategoria(nome: string, ativo = true) {
  return prisma.categoria.upsert({
    where: { nome },
    update: { ativo },
    create: { nome, ativo },
  });
}

export async function seedDeposito(nome: string, ativo = true) {
  return prisma.deposito.upsert({
    where: { nome },
    update: { ativo },
    create: { nome, ativo },
  });
}

export async function seedFuncionario(opts: {
  nome: string;
  cargo: string;
  setorId: string;
  ativo?: boolean;
}) {
  return prisma.funcionario.create({
    data: {
      nome: opts.nome,
      cargo: opts.cargo,
      setorId: opts.setorId,
      ativo: opts.ativo ?? true,
    },
  });
}

export async function seedAdmin() {
  const hashed = await bcrypt.hash(ADMIN_SENHA, 10);
  return prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { senha: hashed, role: "admin", ativo: true, nome: ADMIN_NOME },
    create: {
      nome: ADMIN_NOME,
      email: ADMIN_EMAIL,
      senha: hashed,
      role: "admin",
    },
  });
}

export async function seedUser(opts: {
  email: string;
  senha: string;
  role?: string;
  ativo?: boolean;
  nome?: string;
}) {
  const hashed = await bcrypt.hash(opts.senha, 10);
  return prisma.user.upsert({
    where: { email: opts.email },
    update: {
      senha: hashed,
      role: opts.role ?? "operador",
      ativo: opts.ativo ?? true,
      nome: opts.nome ?? opts.email,
    },
    create: {
      nome: opts.nome ?? opts.email,
      email: opts.email,
      senha: hashed,
      role: opts.role ?? "operador",
      ativo: opts.ativo ?? true,
    },
  });
}

export function extractSid(setCookie: string | string[] | undefined): string | null {
  if (!setCookie) return null;
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of arr) {
    const m = /almox_sid=([^;]+)/.exec(c);
    if (m) return m[1];
  }
  return null;
}

export function buildCookie(sid: string): string {
  return `almox_sid=${sid}`;
}

export async function login(
  app: FastifyInstance,
  email: string,
  senha: string
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, senha },
  });
  if (response.statusCode !== 200) {
    throw new Error(
      `Login falhou para ${email}: ${response.statusCode} ${response.body}`
    );
  }
  const sid = extractSid(response.headers["set-cookie"]);
  if (!sid) throw new Error("Cookie almox_sid não encontrado");
  const cookie = buildCookie(sid);
  try {
    const body = JSON.parse(response.body) as { csrfToken?: string };
    if (body.csrfToken) rememberCsrf(cookie, body.csrfToken);
  } catch {
    // body sem csrf — deixa seguir; testes que precisem falharao explicitamente
  }
  return cookie;
}

export async function loginAsAdmin(app: FastifyInstance): Promise<string> {
  return login(app, ADMIN_EMAIL, ADMIN_SENHA);
}
