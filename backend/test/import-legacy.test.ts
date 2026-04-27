import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { cleanDatabase, prisma } from "./helpers";
import { runLegacyImport, runLegacyImportCli } from "../scripts/import-legacy";

const FIXTURE_PATH = path.resolve(__dirname, "fixtures/legacy-export.json");

function allowImportEnv(): NodeJS.ProcessEnv {
  return { ...process.env, ALLOW_LEGACY_IMPORT: "true" };
}

describe("Import Legacy Script", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("importa JSON valido com contagens corretas", async () => {
    const report = await runLegacyImport(FIXTURE_PATH, {
      prismaClient: prisma,
      env: allowImportEnv(),
    });

    expect(report.setores.created).toBe(5);
    expect(report.categorias.created).toBe(5);
    expect(report.depositos.created).toBe(5);
    expect(report.funcionarios.created).toBe(5);
    expect(report.users.created).toBe(5);
    expect(report.items.created).toBe(5);
    expect(report.entradas.created).toBe(5);
    expect(report.saidas.created).toBe(5);

    expect(await prisma.setor.count()).toBe(5);
    expect(await prisma.categoria.count()).toBe(5);
    expect(await prisma.deposito.count()).toBe(5);
    expect(await prisma.funcionario.count()).toBe(5);
    expect(await prisma.user.count()).toBe(5);
    expect(await prisma.item.count()).toBe(5);
    expect(await prisma.entrada.count()).toBe(5);
    expect(await prisma.saida.count()).toBe(5);

    const auditCount = await prisma.auditLog.count({ where: { action: "LEGACY_IMPORT" } });
    expect(auditCount).toBe(40);
  });

  it("reexecucao e idempotente: created=0 e skipped sobe", async () => {
    await runLegacyImport(FIXTURE_PATH, {
      prismaClient: prisma,
      env: allowImportEnv(),
    });

    const second = await runLegacyImport(FIXTURE_PATH, {
      prismaClient: prisma,
      env: allowImportEnv(),
    });

    expect(second.setores.created).toBe(0);
    expect(second.categorias.created).toBe(0);
    expect(second.depositos.created).toBe(0);
    expect(second.funcionarios.created).toBe(0);
    expect(second.users.created).toBe(0);
    expect(second.items.created).toBe(0);
    expect(second.entradas.created).toBe(0);
    expect(second.saidas.created).toBe(0);

    expect(second.setores.skipped).toBeGreaterThan(0);
    expect(second.users.skipped).toBeGreaterThan(0);
    expect(second.items.skipped).toBeGreaterThan(0);
    expect(second.entradas.skipped).toBeGreaterThan(0);
    expect(second.saidas.skipped).toBeGreaterThan(0);
  });

  it("senha legacy em texto puro e persistida como hash bcrypt", async () => {
    await runLegacyImport(FIXTURE_PATH, {
      prismaClient: prisma,
      env: allowImportEnv(),
    });

    const user = await prisma.user.findUnique({
      where: { email: "admin.legacy@example.com" },
      select: { senha: true },
    });

    expect(user).not.toBeNull();
    expect(user!.senha.startsWith("$2")).toBe(true);
    const ok = await bcrypt.compare("admin12345", user!.senha);
    expect(ok).toBe(true);
  });

  it("entrada com itemCodigo inexistente e skip + warn", async () => {
    const raw = await fs.readFile(FIXTURE_PATH, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as Record<string, unknown>;
    const entradas = Array.isArray(parsed.entradas) ? parsed.entradas : [];
    entradas.push({
      id: 999,
      itemCodigo: "NAOEXISTE-001",
      itemNome: "Item Fantasma",
      qtd: 2,
      valorUnit: 10,
      data: "2026-04-09",
      resp: "Administrador Legacy",
      obs: "invalida",
    });
    parsed.entradas = entradas;

    const tempFile = path.resolve(__dirname, "fixtures/legacy-export.invalid.json");
    await fs.writeFile(tempFile, JSON.stringify(parsed, null, 2), "utf8");

    try {
      const report = await runLegacyImport(tempFile, {
        prismaClient: prisma,
        env: allowImportEnv(),
      });

      expect(report.entradas.skipped).toBeGreaterThanOrEqual(1);
      expect(report.warnings.some((w) => w.includes("itemCodigo/itemId nao encontrado"))).toBe(true);
    } finally {
      await fs.rm(tempFile, { force: true });
    }
  });

  it("sem ALLOW_LEGACY_IMPORT retorna codigo de erro no CLI", async () => {
    const logs: string[] = [];
    const errors: string[] = [];

    const code = await runLegacyImportCli(
      [FIXTURE_PATH],
      { ...process.env, ALLOW_LEGACY_IMPORT: "false" },
      {
        log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
        error: (...args: unknown[]) => errors.push(args.map(String).join(" ")),
      },
      prisma
    );

    expect(code).toBe(1);
    expect(errors.length).toBeGreaterThan(0);
    expect(await prisma.user.count()).toBe(0);
  });
});
