import { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../infra/prisma";
import { AppError } from "../../../shared/errors/app-error";
import { buildDiff } from "../../../shared/utils/diff";
import { normalizeName } from "../../../shared/utils/normalize-name";
import {
  createCategoriaSchema,
  updateCategoriaSchema,
  listCategoriasQuerySchema,
} from "./categorias.schema";

const PUBLIC_SELECT = {
  id: true,
  nome: true,
  ativo: true,
  criadoEm: true,
} as const;

const DIFFABLE = ["nome", "ativo"] as const;

export const listCategoriasHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const q = listCategoriasQuerySchema.parse(req.query ?? {});
  const where: Prisma.CategoriaWhereInput = {};
  if (typeof q.ativo === "boolean") where.ativo = q.ativo;
  if (q.search) where.nome = { contains: q.search, mode: "insensitive" };

  const skip = (q.page - 1) * q.limit;
  const [total, categorias] = await prisma.$transaction([
    prisma.categoria.count({ where }),
    prisma.categoria.findMany({
      where,
      select: PUBLIC_SELECT,
      orderBy: { nome: "asc" },
      skip,
      take: q.limit,
    }),
  ]);

  return reply.send({
    categorias,
    meta: {
      total,
      page: q.page,
      limit: q.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / q.limit),
    },
  });
};

export const getCategoriaHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const categoria = await prisma.categoria.findUnique({ where: { id }, select: PUBLIC_SELECT });
  if (!categoria) throw AppError.notFound("Categoria não encontrada");
  return reply.send({ categoria });
};

export const createCategoriaHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const data = createCategoriaSchema.parse(req.body);
  const nome = normalizeName(data.nome);

  const existing = await prisma.categoria.findUnique({ where: { nome } });
  if (existing) throw AppError.conflict("Categoria com esse nome já existe");

  const categoria = await prisma.categoria.create({
    data: { nome },
    select: PUBLIC_SELECT,
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "CATEGORIA_CREATED",
      target: categoria.id,
      details: JSON.stringify({ nome: categoria.nome }),
      ipAddress: req.ip || null,
    },
  });

  return reply.status(201).send({ categoria });
};

export const updateCategoriaHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const data = updateCategoriaSchema.parse(req.body);

  const target = await prisma.categoria.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("Categoria não encontrada");

  if (data.nome !== undefined) {
    const novoNome = normalizeName(data.nome);
    if (novoNome !== target.nome) {
      const clash = await prisma.categoria.findUnique({ where: { nome: novoNome } });
      if (clash) throw AppError.conflict("Categoria com esse nome já existe");
    }
    data.nome = novoNome;
  }

  const before = { nome: target.nome, ativo: target.ativo };
  const updated = await prisma.categoria.update({
    where: { id },
    data,
    select: PUBLIC_SELECT,
  });
  const after = { nome: updated.nome, ativo: updated.ativo };

  const changed = buildDiff(before, after, DIFFABLE, data);

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: data.ativo === false ? "CATEGORIA_DEACTIVATED" : "CATEGORIA_UPDATED",
      target: updated.id,
      details: JSON.stringify(changed),
      ipAddress: req.ip || null,
    },
  });

  return reply.send({ categoria: updated });
};

export const deleteCategoriaHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };

  const target = await prisma.categoria.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("Categoria não encontrada");

  if (target.ativo) {
    await prisma.categoria.update({ where: { id }, data: { ativo: false } });
  }

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "CATEGORIA_DEACTIVATED",
      target: id,
      ipAddress: req.ip || null,
    },
  });

  return reply.send({ message: "Categoria desativada" });
};
