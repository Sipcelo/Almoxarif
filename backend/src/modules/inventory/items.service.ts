import { Prisma } from "@prisma/client";
import { prisma } from "../../infra/prisma";
import { AppError } from "../../shared/errors/app-error";
import { buildDiff } from "../../shared/utils/diff";
import { CreateItemInput, ListItemsQueryInput, UpdateItemInput } from "./items.schema";
import { assertCategoriaAtiva, assertDepositoAtivo } from "./items.guards";

const ITEM_SELECT = {
  id: true,
  codigo: true,
  descricao: true,
  categoriaId: true,
  depositoId: true,
  quantidade: true,
  minimo: true,
  valorAtual: true,
  obs: true,
  ativo: true,
  criadoEm: true,
  atualizadoEm: true,
  categoria: { select: { id: true, nome: true, ativo: true } },
  deposito: { select: { id: true, nome: true, ativo: true } },
} as const;

const DIFFABLE = ["codigo", "descricao", "categoriaId", "depositoId", "minimo", "valorAtual", "obs"] as const;

function money(v: number) {
  return new Prisma.Decimal(v);
}

export async function listItems(query: ListItemsQueryInput) {
  const where: Prisma.ItemWhereInput = {};
  const andFilters: Prisma.ItemWhereInput[] = [];

  if (typeof query.ativo === "boolean") where.ativo = query.ativo;
  if (query.categoriaId) where.categoriaId = query.categoriaId;
  if (query.depositoId) where.depositoId = query.depositoId;
  if (query.search) {
    where.OR = [
      { codigo: { contains: query.search, mode: "insensitive" } },
      { descricao: { contains: query.search, mode: "insensitive" } },
    ];
  }
  if (query.baixoEstoque === true) {
    andFilters.push({ quantidade: { lt: prisma.item.fields.minimo } });
  }
  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  const skip = (query.page - 1) * query.limit;
  const [total, items] = await prisma.$transaction([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      select: ITEM_SELECT,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    items,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function getItemOrFail(id: string) {
  const item = await prisma.item.findUnique({ where: { id }, select: ITEM_SELECT });
  if (!item) throw AppError.notFound("Item nao encontrado");
  return item;
}

export async function createItem(data: CreateItemInput, actorId: string, ipAddress?: string) {
  await assertCategoriaAtiva(data.categoriaId);
  await assertDepositoAtivo(data.depositoId);

  const existing = await prisma.item.findUnique({ where: { codigo: data.codigo } });
  if (existing) throw AppError.conflict("Codigo do item ja cadastrado");

  const item = await prisma.item.create({
    data: {
      codigo: data.codigo,
      descricao: data.descricao,
      categoriaId: data.categoriaId,
      depositoId: data.depositoId,
      quantidade: data.quantidade,
      minimo: data.minimo,
      valorAtual: money(data.valorAtual),
      obs: data.obs ?? null,
    },
    select: ITEM_SELECT,
  });

  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action: "ITEM_CREATED",
      target: item.id,
      details: JSON.stringify({
        codigo: item.codigo,
        descricao: item.descricao,
        categoriaId: item.categoriaId,
        depositoId: item.depositoId,
        quantidadeInicial: item.quantidade,
        minimo: item.minimo,
        valorAtual: item.valorAtual.toString(),
      }),
      ipAddress: ipAddress || null,
    },
  });

  return item;
}

export async function updateItem(id: string, data: UpdateItemInput, actorId: string, ipAddress?: string) {
  const target = await prisma.item.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("Item nao encontrado");

  if (data.categoriaId && data.categoriaId !== target.categoriaId) {
    await assertCategoriaAtiva(data.categoriaId);
  }
  if (data.depositoId && data.depositoId !== target.depositoId) {
    await assertDepositoAtivo(data.depositoId);
  }

  if (data.codigo && data.codigo !== target.codigo) {
    const clash = await prisma.item.findUnique({ where: { codigo: data.codigo } });
    if (clash) throw AppError.conflict("Codigo do item ja cadastrado");
  }

  const before = {
    codigo: target.codigo,
    descricao: target.descricao,
    categoriaId: target.categoriaId,
    depositoId: target.depositoId,
    minimo: target.minimo,
    valorAtual: target.valorAtual.toString(),
    obs: target.obs,
  };

  const updated = await prisma.item.update({
    where: { id },
    data: {
      ...data,
      valorAtual: data.valorAtual !== undefined ? money(data.valorAtual) : undefined,
      obs: data.obs === undefined ? undefined : data.obs,
    },
    select: ITEM_SELECT,
  });

  const after = {
    codigo: updated.codigo,
    descricao: updated.descricao,
    categoriaId: updated.categoriaId,
    depositoId: updated.depositoId,
    minimo: updated.minimo,
    valorAtual: updated.valorAtual.toString(),
    obs: updated.obs,
  };

  const changed = buildDiff(before, after, DIFFABLE as readonly (keyof typeof before)[], {
    ...data,
    valorAtual: data.valorAtual?.toString(),
  } as Partial<typeof before>);

  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action: "ITEM_UPDATED",
      target: updated.id,
      details: JSON.stringify({ before, after, diff: changed }),
      ipAddress: ipAddress || null,
    },
  });

  return updated;
}

export async function deactivateItem(id: string, actorId: string, ipAddress?: string) {
  const target = await prisma.item.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("Item nao encontrado");

  if (target.ativo) {
    await prisma.item.update({ where: { id }, data: { ativo: false } });
  }

  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action: "ITEM_DEACTIVATED",
      target: id,
      ipAddress: ipAddress || null,
    },
  });
}
