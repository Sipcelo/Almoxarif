import { prisma } from "../../infra/prisma";
import { AppError } from "../../shared/errors/app-error";
import type { UpdateUserInput } from "./users.schema";

type Actor = { id: string };
type Target = { id: string; role: string; ativo: boolean };

export async function countActiveAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: "admin", ativo: true } });
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export function assertNotSelfDemotionOrDeactivation(
  actor: Actor,
  target: Target,
  data: Pick<UpdateUserInput, "role" | "ativo">
): void {
  if (actor.id !== target.id) return;
  const roleChanging = data.role !== undefined && data.role !== target.role;
  const deactivating = data.ativo === false;
  if (roleChanging || deactivating) {
    throw AppError.conflict(
      "Administrador não pode desativar ou rebaixar a si mesmo"
    );
  }
}

export function isDemotingOrDeactivatingAdmin(
  target: Target,
  data: Pick<UpdateUserInput, "role" | "ativo">
): boolean {
  if (target.role !== "admin" || !target.ativo) return false;
  const demoting = data.role !== undefined && data.role !== "admin";
  const deactivating = data.ativo === false;
  return demoting || deactivating;
}

export async function assertNotLastActiveAdmin(): Promise<void> {
  const activeAdmins = await countActiveAdmins();
  if (activeAdmins <= 1) {
    throw AppError.conflict(
      "Não é possível remover/desativar o último administrador ativo"
    );
  }
}
