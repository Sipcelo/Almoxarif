import { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../infra/prisma";
import { AppError } from "../../../shared/errors/app-error";
import { buildDiff } from "../../../shared/utils/diff";
import { normalizeName } from "../../../shared/utils/normalize-name";
import {
  createSetorSchema,
  updateSetorSchema,
  listSetoresQuerySchema,
} from "./setores.schema";

const PUBLIC_SELECT = {
  id: true,
  nome: true,
  ativo: true,
  criadoEm: true,
} as const;

const DIFFABLE = ["nome", "ativo"] as const;

async function countActiveFuncionariosInSetor(setorId: string): Promise<number> {
  return prisma.funcionario.count({ where: { setorId, ativo: true } });
}

export const listSetoresHandler = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  const q = listSetoresQuerySchema.parse(req.query ?? {});
  const where: Prisma.SetorWhereInput = {};
  if (typeof q.ativo === "boolean") where.ativo = q.ativo;
  if (q.search) where.nome = { contains: q.search, mode: "insensitive" };

  const skip = (q.page - 1) * q.limit;
  const [total, setores] = await prisma.$transaction([
    prisma.setor.count({ where }),
    prisma.setor.findMany({
      where,
      select: PUBLIC_SELECT,
      orderBy: { nome: "asc" },
      skip,
      take: q.limit,
    }),
  ]);

  return reply.send({
    setores,
    meta: {
      total,
      page: q.page,
      limit: q.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / q.limit),
    },
  });
};

export const getSetorHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const setor = await prisma.setor.findUnique({ where: { id }, select: PUBLIC_SELECT });
  if (!setor) throw AppError.notFound("Setor não encontrado");
  return reply.send({ setor });
};

export const createSetorHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const data = createSetorSchema.parse(req.body);
  const nome = normalizeName(data.nome);

  const existing = await prisma.setor.findUnique({ where: { nome } });
  if (existing) throw AppError.conflict("Setor com esse nome já existe");

  const setor = await prisma.setor.create({
    data: { nome },
    select: PUBLIC_SELECT,
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "SETOR_CREATED",
      target: setor.id,
      details: JSON.stringify({ nome: setor.nome }),
      ipAddress: req.ip || null,
    },
  });

  return reply.status(201).send({ setor });
};

export const updateSetorHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const data = updateSetorSchema.parse(req.body);

  const target = await prisma.setor.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("Setor não encontrado");

  if (data.nome !== undefined) {
    const novoNome = normalizeName(data.nome);
    if (novoNome !== target.nome) {
      const clash = await prisma.setor.findUnique({ where: { nome: novoNome } });
      if (clash) throw AppError.conflict("Setor com esse nome já existe");
      data.nome = novoNome;
    } else {
      data.nome = novoNome;
    }
  }

  if (data.ativo === false && target.ativo) {
    const count = await countActiveFuncionariosInSetor(id);
    if (count > 0) {
      throw AppError.conflict("Setor tem funcionários ativos vinculados");
    }
  }

  const before = { nome: target.nome, ativo: target.ativo };
  const updated = await prisma.setor.update({
    where: { id },
    data,
    select: PUBLIC_SELECT,
  });
  const after = { nome: updated.nome, ativo: updated.ativo };

  const changed = buildDiff(before, after, DIFFABLE, data);

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: data.ativo === false ? "SETOR_DEACTIVATED" : "SETOR_UPDATED",
      target: updated.id,
      details: JSON.stringify(changed),
      ipAddress: req.ip || null,
    },
  });

  return reply.send({ setor: updated });
};

export const deleteSetorHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };

  const target = await prisma.setor.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("Setor não encontrado");

  if (target.ativo) {
    const count = await countActiveFuncionariosInSetor(id);
    if (count > 0) {
      throw AppError.conflict("Setor tem funcionários ativos vinculados");
    }
    await prisma.setor.update({ where: { id }, data: { ativo: false } });
  }

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "SETOR_DEACTIVATED",
      target: id,
      ipAddress: req.ip || null,
    },
  });

  return reply.send({ message: "Setor desativado" });
};
