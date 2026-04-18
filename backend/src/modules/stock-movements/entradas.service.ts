import { Prisma } from "@prisma/client";
import { prisma } from "../../infra/prisma";
import { AppError } from "../../shared/errors/app-error";
import { assertItemAtivo } from "./guards";
import { CreateEntradaInput, ListEntradasQueryInput } from "./entradas.schema";

const ENTRADA_SELECT = {
  id: true,
  itemId: true,
  qtd: true,
  valorUnit: true,
  data: true,
  responsavelUserId: true,
  obs: true,
  criadoEm: true,
  item: { select: { id: true, codigo: true, descricao: true } },
} as const;

function toDecimal(n: number) {
  return new Prisma.Decimal(n);
}

export async function createEntrada(data: CreateEntradaInput, actorId: string, ipAddress?: string) {
  const when = data.data ? new Date(data.data) : new Date();

  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id: data.itemId } });
    if (!item) throw AppError.notFound("Item nao encontrado");
    if (!item.ativo) throw AppError.conflict("Item inativo");

    const saldoAntes = item.quantidade;
    const saldoDepois = saldoAntes + data.qtd;

    const entrada = await tx.entrada.create({
      data: {
        itemId: data.itemId,
        qtd: data.qtd,
        valorUnit: toDecimal(data.valorUnit),
        data: when,
        responsavelUserId: actorId,
        obs: data.obs ?? null,
      },
      select: ENTRADA_SELECT,
    });

    await tx.item.update({
      where: { id: data.itemId },
      data: {
        quantidade: { increment: data.qtd },
        valorAtual: toDecimal(data.valorUnit),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "ENTRADA_CREATED",
        target: entrada.id,
        details: JSON.stringify({
          itemId: data.itemId,
          qtd: data.qtd,
          saldoAntes,
          saldoDepois,
          valorUnit: data.valorUnit.toFixed(2),
        }),
        ipAddress: ipAddress || null,
      },
    });

    return entrada;
  });
}

export async function listEntradas(query: ListEntradasQueryInput) {
  const where: Prisma.EntradaWhereInput = {};
  if (query.itemId) where.itemId = query.itemId;
  if (query.dataInicio || query.dataFim) {
    where.data = {};
    if (query.dataInicio) where.data.gte = new Date(query.dataInicio);
    if (query.dataFim) where.data.lte = new Date(query.dataFim);
  }

  const skip = (query.page - 1) * query.limit;
  const [total, entradas] = await prisma.$transaction([
    prisma.entrada.count({ where }),
    prisma.entrada.findMany({
      where,
      select: ENTRADA_SELECT,
      orderBy: { data: "desc" },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    entradas,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function getEntradaOrFail(id: string) {
  const entrada = await prisma.entrada.findUnique({ where: { id }, select: ENTRADA_SELECT });
  if (!entrada) throw AppError.notFound("Entrada nao encontrada");
  return entrada;
}

