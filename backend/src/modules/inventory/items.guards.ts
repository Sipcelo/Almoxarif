import { prisma } from "../../infra/prisma";
import { AppError } from "../../shared/errors/app-error";

export async function assertCategoriaAtiva(categoriaId: string) {
  const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } });
  if (!categoria) throw AppError.validation("Categoria invalida");
  if (!categoria.ativo) throw AppError.conflict("Categoria inativa");
}

export async function assertDepositoAtivo(depositoId: string) {
  const deposito = await prisma.deposito.findUnique({ where: { id: depositoId } });
  if (!deposito) throw AppError.validation("Deposito invalido");
  if (!deposito.ativo) throw AppError.conflict("Deposito inativo");
}
