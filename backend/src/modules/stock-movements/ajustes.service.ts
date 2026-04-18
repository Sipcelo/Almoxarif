import { prisma } from "../../infra/prisma";
import { AppError } from "../../shared/errors/app-error";
import { CreateAjusteInput, ListAjustesQueryInput } from "./ajustes.schema";
import { Prisma } from "@prisma/client";

const AJUSTE_SELECT = {
  id: true,
  itemId: true,
  qtdAnterior: true,
  qtdNova: true,
  motivo: true,
  responsavelUserId: true,
  obs: true,
  criadoEm: true,
  item: { select: { id: true, codigo: true, descricao: true } },
} as const;

export async function createAjuste(data: CreateAjusteInput, actorId: string, ipAddress?: string) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id: data.itemId } });
    if (!item) throw AppError.notFound("Item nao encontrado");
    if (!item.ativo) throw AppError.conflict("Item inativo");

    const qtdAnterior = item.quantidade;

    await tx.item.update({
      where: { id: data.itemId },
      data: { quantidade: data.qtdNova },
    });

    const ajuste = await tx.ajuste.create({
      data: {
        itemId: data.itemId,
        qtdAnterior,
        qtdNova: data.qtdNova,
        motivo: data.motivo,
        responsavelUserId: actorId,
        obs: data.obs ?? null,
      },
      select: AJUSTE_SELECT,
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "AJUSTE_CREATED",
        target: ajuste.id,
        details: JSON.stringify({
          itemId: data.itemId,
          qtdAnterior,
          qtdNova: data.qtdNova,
          motivo: data.motivo,
        }),
        ipAddress: ipAddress || null,
      },
    });

    return ajuste;
  });
}

export async function listAjustes(query: ListAjustesQueryInput) {
  const where: Prisma.AjusteWhereInput = {};
  if (query.itemId) where.itemId = query.itemId;
  if (query.dataInicio || query.dataFim) {
    where.criadoEm = {};
    if (query.dataInicio) where.criadoEm.gte = new Date(query.dataInicio);
    if (query.dataFim) where.criadoEm.lte = new Date(query.dataFim);
  }

  const skip = (query.page - 1) * query.limit;
  const [total, ajustes] = await prisma.$transaction([
    prisma.ajuste.count({ where }),
    prisma.ajuste.findMany({
      where,
      select: AJUSTE_SELECT,
      orderBy: { criadoEm: "desc" },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    ajustes,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function getAjusteOrFail(id: string) {
  const ajuste = await prisma.ajuste.findUnique({ where: { id }, select: AJUSTE_SELECT });
  if (!ajuste) throw AppError.notFound("Ajuste nao encontrado");
  return ajuste;
}
