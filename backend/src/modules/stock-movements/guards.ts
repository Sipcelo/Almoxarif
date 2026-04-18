import { prisma } from "../../infra/prisma";
import { AppError } from "../../shared/errors/app-error";

export async function assertItemAtivo(itemId: string) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw AppError.notFound("Item nao encontrado");
  if (!item.ativo) throw AppError.conflict("Item inativo");
  return item;
}

export async function assertFuncionarioAtivo(funcionarioId: string) {
  const funcionario = await prisma.funcionario.findUnique({
    where: { id: funcionarioId },
    include: { setor: true },
  });
  if (!funcionario) throw AppError.notFound("Funcionario nao encontrado");
  if (!funcionario.ativo) throw AppError.conflict("Funcionario inativo");
  if (!funcionario.setor || !funcionario.setor.ativo) {
    throw AppError.conflict("Setor do funcionario esta inativo");
  }

  return {
    funcionario,
    setorSnapshotId: funcionario.setor.id,
    setorSnapshotNome: funcionario.setor.nome,
  };
}
