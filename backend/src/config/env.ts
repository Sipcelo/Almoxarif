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

export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  const missing: string[] = [];
  const weak: string[] = [];

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

  if (missing.length === 0 && weak.length === 0) return;

  const errors: string[] = [];
  if (missing.length > 0) {
    errors.push(`Variáveis obrigatórias ausentes: ${missing.join(", ")}`);
  }
  if (weak.length > 0) {
    errors.push(`Variáveis com valor inválido: ${weak.join(", ")}`);
  }
  const message = `[ENV] Boot abortado. ${errors.join(" | ")}`;
  throw new Error(message);
}
