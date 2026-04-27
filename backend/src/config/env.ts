/**
 * Validação de variáveis de ambiente obrigatórias no boot.
 *
 * Executa antes de qualquer registro de rota. Falha cedo com mensagem
 * explícita em stderr, evitando boot parcial com secrets ausentes.
 */

const REQUIRED: Array<{ key: string; minLength?: number }> = [
  { key: "DATABASE_URL" },
  { key: "SESSION_SECRET", minLength: 32 },
];

function isEnabled(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  const missing: string[] = [];
  const weak: string[] = [];
  const invalid: string[] = [];

  for (const { key, minLength } of REQUIRED) {
    const value = env[key];
    if (!value || value.trim().length === 0) {
      missing.push(key);
      continue;
    }
    if (minLength && value.length < minLength) {
      weak.push(`${key} (mínimo ${minLength} caracteres)`);
    }
  }

  if (env.NODE_ENV === "production") {
    const corsOrigin = env.CORS_ORIGIN;
    if (!corsOrigin || corsOrigin.trim().length === 0) {
      missing.push("CORS_ORIGIN");
    } else if (
      corsOrigin
        .split(",")
        .map((origin) => origin.trim())
        .includes("*")
    ) {
      invalid.push("CORS_ORIGIN (wildcard proibido em produção)");
    }

    const databaseUrl = env.DATABASE_URL;
    if (
      databaseUrl &&
      !databaseUrl.startsWith("postgresql://") &&
      !databaseUrl.startsWith("postgres://")
    ) {
      invalid.push("DATABASE_URL (deve usar PostgreSQL em produção)");
    }

    if (isEnabled(env.SEED_ENABLED)) {
      invalid.push("SEED_ENABLED (deve ser false em produção)");
    }
  }

  if (missing.length === 0 && weak.length === 0 && invalid.length === 0) return;

  const errors: string[] = [];
  if (missing.length > 0) {
    errors.push(`Variáveis obrigatórias ausentes: ${missing.join(", ")}`);
  }
  if (weak.length > 0) {
    errors.push(`Variáveis com valor inválido: ${weak.join(", ")}`);
  }
  if (invalid.length > 0) {
    errors.push(`Variáveis com configuração insegura: ${invalid.join(", ")}`);
  }
  const message = `[ENV] Boot abortado. ${errors.join(" | ")}`;
  throw new Error(message);
}
