import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

type CliIO = {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

type BootstrapResult = {
  action: "created" | "promoted" | "skipped";
  userId?: string;
  email?: string;
  reason?: string;
};

type RunOptions = {
  prismaClient: PrismaClient;
  env?: NodeJS.ProcessEnv;
};

const CONFIRM_VALUE = "CREATE_INITIAL_ADMIN";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readRequired(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} e obrigatorio para bootstrap de admin.`);
  return value;
}

function assertSafeInput(env: NodeJS.ProcessEnv): {
  email: string;
  password: string;
  nome: string;
} {
  const confirm = readRequired(env, "BOOTSTRAP_CONFIRM");
  if (confirm !== CONFIRM_VALUE) {
    throw new Error(`BOOTSTRAP_CONFIRM deve ser ${CONFIRM_VALUE}.`);
  }

  const email = readRequired(env, "BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL deve ser um e-mail valido.");
  }

  const password = readRequired(env, "BOOTSTRAP_ADMIN_PASSWORD");
  if (password.length < 12 || password.length > 128) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD deve ter entre 12 e 128 caracteres.");
  }

  const nome = env.BOOTSTRAP_ADMIN_NAME?.trim() || "Administrador";
  return { email, password, nome };
}

export async function runBootstrapAdmin(options: RunOptions): Promise<BootstrapResult> {
  const env = options.env ?? process.env;
  const input = assertSafeInput(env);

  const activeAdmins = await options.prismaClient.user.count({
    where: { role: "admin", ativo: true },
  });
  if (activeAdmins > 0) {
    return {
      action: "skipped",
      reason: "ja existe admin ativo",
    };
  }

  const hashed = await bcrypt.hash(input.password, 12);
  const existing = await options.prismaClient.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  const user = existing
    ? await options.prismaClient.user.update({
        where: { id: existing.id },
        data: {
          nome: input.nome,
          senha: hashed,
          role: "admin",
          ativo: true,
        },
        select: { id: true, email: true },
      })
    : await options.prismaClient.user.create({
        data: {
          nome: input.nome,
          email: input.email,
          senha: hashed,
          role: "admin",
          ativo: true,
        },
        select: { id: true, email: true },
      });

  await options.prismaClient.auditLog.create({
    data: {
      userId: user.id,
      action: "ADMIN_BOOTSTRAPPED",
      target: user.id,
      details: JSON.stringify({
        source: "scripts/bootstrap-admin",
        email: user.email,
        mode: existing ? "promoted" : "created",
      }),
      ipAddress: null,
    },
  });

  return {
    action: existing ? "promoted" : "created",
    userId: user.id,
    email: user.email,
  };
}

export async function runBootstrapAdminCli(
  env: NodeJS.ProcessEnv = process.env,
  io: CliIO = console,
  prismaClient?: PrismaClient
): Promise<number> {
  const ownClient = !prismaClient;
  const prisma = prismaClient ?? new PrismaClient();

  try {
    const result = await runBootstrapAdmin({ prismaClient: prisma, env });
    io.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.error(message);
    return 1;
  } finally {
    if (ownClient) {
      await prisma.$disconnect();
    }
  }
}

if (typeof require !== "undefined" && require.main === module) {
  runBootstrapAdminCli().then((code) => {
    process.exitCode = code;
  });
}
