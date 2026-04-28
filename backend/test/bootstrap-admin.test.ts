import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cleanDatabase, prisma, seedUser } from "./helpers";
import { runBootstrapAdmin, runBootstrapAdminCli } from "../scripts/bootstrap-admin";

const validEnv = {
  ...process.env,
  BOOTSTRAP_CONFIRM: "CREATE_INITIAL_ADMIN",
  BOOTSTRAP_ADMIN_EMAIL: "primeiro.admin@example.com",
  BOOTSTRAP_ADMIN_PASSWORD: "SenhaInicial123!",
  BOOTSTRAP_ADMIN_NAME: "Primeiro Admin",
};

describe("Bootstrap admin script", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("exige confirmacao explicita", async () => {
    const errors: string[] = [];
    const code = await runBootstrapAdminCli(
      { ...validEnv, BOOTSTRAP_CONFIRM: "wrong" },
      { log: () => undefined, error: (...args) => errors.push(args.join(" ")) },
      prisma
    );

    expect(code).toBe(1);
    expect(errors.join(" ")).toContain("BOOTSTRAP_CONFIRM");
    expect(await prisma.user.count()).toBe(0);
  });

  it("cria primeiro admin ativo com senha hasheada e audit log", async () => {
    const result = await runBootstrapAdmin({ prismaClient: prisma, env: validEnv });

    expect(result.action).toBe("created");
    const user = await prisma.user.findUnique({
      where: { email: "primeiro.admin@example.com" },
    });

    expect(user).not.toBeNull();
    expect(user!.role).toBe("admin");
    expect(user!.ativo).toBe(true);
    expect(user!.senha).not.toBe(validEnv.BOOTSTRAP_ADMIN_PASSWORD);
    expect(await bcrypt.compare(validEnv.BOOTSTRAP_ADMIN_PASSWORD, user!.senha)).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "ADMIN_BOOTSTRAPPED", target: user!.id },
    });
    expect(audit).not.toBeNull();
  });

  it("promove usuario existente quando nao ha admin ativo", async () => {
    const existing = await seedUser({
      email: "primeiro.admin@example.com",
      senha: "senha-antiga-123",
      role: "operador",
      ativo: false,
      nome: "Operador Antigo",
    });

    const result = await runBootstrapAdmin({ prismaClient: prisma, env: validEnv });

    expect(result.action).toBe("promoted");
    expect(result.userId).toBe(existing.id);

    const user = await prisma.user.findUnique({ where: { id: existing.id } });
    expect(user!.role).toBe("admin");
    expect(user!.ativo).toBe(true);
    expect(user!.nome).toBe("Primeiro Admin");
  });

  it("nao altera banco quando ja existe admin ativo", async () => {
    await seedUser({
      email: "admin.existente@example.com",
      senha: "admin-existente-123",
      role: "admin",
      ativo: true,
    });

    const result = await runBootstrapAdmin({ prismaClient: prisma, env: validEnv });

    expect(result.action).toBe("skipped");
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "ADMIN_BOOTSTRAPPED" } })).toBe(0);
  });
});
