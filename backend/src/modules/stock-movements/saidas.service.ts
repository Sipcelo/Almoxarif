import { Prisma } from "@prisma/client";
import { prisma } from "../../infra/prisma";
import { AppError } from "../../shared/errors/app-error";
import { assertFuncionarioAtivo } from "./guards";
import { CreateSaidaInput, ListSaidasQueryInput } from "./saidas.schema";

const SAIDA_SELECT = {
  id: true,
  itemId: true,
  qtd: true,
  valorUnit: true,
  data: true,
  funcionarioId: true,
  setorSnapshotId: true,
  setorSnapshotNome: true,
  responsavelUserId: true,
  obs: true,
  criadoEm: true,
  item: { select: { id: true, codigo: true, descricao: true } },
  funcionario: { select: { id: true, nome: true, cargo: true } },
} as const;

function toDecimal(n: number) {
  return new Prisma.Decimal(n);
}

export async function createSaida(data: CreateSaidaInput, actorId: string, ipAddress?: string) {
  const when = data.data ? new Date(data.data) : new Date();

  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id: data.itemId } });
    if (!item) throw AppError.notFound("Item nao encontrado");
    if (!item.ativo) throw AppError.conflict("Item inativo");

    const funcionario = await tx.funcionario.findUnique({
      where: { id: data.funcionarioId },
      include: { setor: true },
    });
    if (!funcionario) throw AppError.notFound("Funcionario nao encontrado");
    if (!funcionario.ativo) throw AppError.conflict("Funcionario inativo");
    if (!funcionario.setor || !funcionario.setor.ativo) {
      throw AppError.conflict("Setor do funcionario esta inativo");
    }

    const decremented = await tx.item.updateMany({
      where: {
        id: data.itemId,
        ativo: true,
        quantidade: { gte: data.qtd },
      },
      data: {
        quantidade: { decrement: data.qtd },
      },
    });

    if (decremented.count === 0) {
      throw AppError.conflict("Saldo insuficiente para realizar saida");
    }

    const itemAfter = await tx.item.findUnique({ where: { id: data.itemId } });
    if (!itemAfter) throw AppError.notFound("Item nao encontrado");

    const saldoDepois = itemAfter.quantidade;
    const saldoAntes = saldoDepois + data.qtd;

    const saida = await tx.saida.create({
      data: {
        itemId: data.itemId,
        qtd: data.qtd,
        valorUnit: toDecimal(data.valorUnit),
        data: when,
        funcionarioId: data.funcionarioId,
        setorSnapshotId: funcionario.setor.id,
        setorSnapshotNome: funcionario.setor.nome,
        responsavelUserId: actorId,
        obs: data.obs ?? null,
      },
      select: SAIDA_SELECT,
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "SAIDA_CREATED",
        target: saida.id,
        details: JSON.stringify({
          itemId: data.itemId,
          funcionarioId: data.funcionarioId,
          setorSnapshotId: funcionario.setor.id,
          setorSnapshotNome: funcionario.setor.nome,
          qtd: data.qtd,
          saldoAntes,
          saldoDepois,
          valorUnit: data.valorUnit.toFixed(2),
        }),
        ipAddress: ipAddress || null,
      },
    });

    return saida;
  });
}

export async function listSaidas(query: ListSaidasQueryInput) {
  const where: Prisma.SaidaWhereInput = {};
  if (query.itemId) where.itemId = query.itemId;
  if (query.dataInicio || query.dataFim) {
    where.data = {};
    if (query.dataInicio) where.data.gte = new Date(query.dataInicio);
    if (query.dataFim) where.data.lte = new Date(query.dataFim);
  }

  const skip = (query.page - 1) * query.limit;
  const [total, saidas] = await prisma.$transaction([
    prisma.saida.count({ where }),
    prisma.saida.findMany({
      where,
      select: SAIDA_SELECT,
      orderBy: { data: "desc" },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    saidas,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function getSaidaOrFail(id: string) {
  const saida = await prisma.saida.findUnique({ where: { id }, select: SAIDA_SELECT });
  if (!saida) throw AppError.notFound("Saida nao encontrada");
  return saida;
}

