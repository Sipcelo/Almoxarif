import { prisma } from "../../infra/prisma";
import { AppError } from "../../shared/errors/app-error";

/**
 * Valida que o Setor existe e está ativo. Usado em create e em update com troca de setor.
 * - Setor inexistente → 400 VALIDATION_ERROR (input apontou para id inválido).
 * - Setor inativo → 409 CONFLICT (não aceita novos vínculos).
 */
export async function assertSetorUsable(setorId: string): Promise<void> {
  const setor = await prisma.setor.findUnique({ where: { id: setorId } });
  if (!setor) {
    throw AppError.validation("setorId não corresponde a um Setor existente", [
      { path: "setorId", message: "Setor não encontrado" },
    ]);
  }
  if (!setor.ativo) {
    throw AppError.conflict("Setor inativo não aceita novos funcionários");
  }
}
