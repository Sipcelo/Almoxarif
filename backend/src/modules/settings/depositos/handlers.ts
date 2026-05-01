import { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../infra/prisma";
import { AppError } from "../../../shared/errors/app-error";
import { buildDiff } from "../../../shared/utils/diff";
import { normalizeName } from "../../../shared/utils/normalize-name";
import {
  createDepositoSchema,
  updateDepositoSchema,
  listDepositosQuerySchema,
} from "./depositos.schema";

const PUBLIC_SELECT = {
  id: true,
  nome: true,
  ativo: true,
  criadoEm: true,
} as const;

const DIFFABLE = ["nome", "ativo"] as const;

export const listDepositosHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const q = listDepositosQuerySchema.parse(req.query ?? {});
  const where: Prisma.DepositoWhereInput = {};
  if (typeof q.ativo === "boolean") where.ativo = q.ativo;
  if (q.search) where.nome = { contains: q.search, mode: "insensitive" };

  const skip = (q.page - 1) * q.limit;
  const [total, depositos] = await prisma.$transaction([
    prisma.deposito.count({ where }),
    prisma.deposito.findMany({
      where,
      select: PUBLIC_SELECT,
      orderBy: { nome: "asc" },
      skip,
      take: q.limit,
    }),
  ]);

  return reply.send({
    depositos,
    meta: {
      total,
      page: q.page,
      limit: q.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / q.limit),
    },
  });
};

export const getDepositoHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const deposito = await prisma.deposito.findUnique({ where: { id }, select: PUBLIC_SELECT });
  if (!deposito) throw AppError.notFound("Depósito não encontrado");
  return reply.send({ deposito });
};

export const createDepositoHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const data = createDepositoSchema.parse(req.body);
  const nome = normalizeName(data.nome);

  const existing = await prisma.deposito.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" } },
  });
  if (existing) throw AppError.conflict("Depósito com esse nome já existe");

  const deposito = await prisma.deposito.create({
    data: { nome },
    select: PUBLIC_SELECT,
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "DEPOSITO_CREATED",
      target: deposito.id,
      details: JSON.stringify({ nome: deposito.nome }),
      ipAddress: req.ip || null,
    },
  });

  return reply.status(201).send({ deposito });
};

export const updateDepositoHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const data = updateDepositoSchema.parse(req.body);

  const target = await prisma.deposito.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("Depósito não encontrado");

  if (data.nome !== undefined) {
    const novoNome = normalizeName(data.nome);
    if (novoNome.toLowerCase() !== target.nome.toLowerCase()) {
      const clash = await prisma.deposito.findFirst({
        where: { nome: { equals: novoNome, mode: "insensitive" }, id: { not: id } },
      });
      if (clash) throw AppError.conflict("Depósito com esse nome já existe");
    }
    data.nome = novoNome;
  }

  const before = { nome: target.nome, ativo: target.ativo };
  const updated = await prisma.deposito.update({
    where: { id },
    data,
    select: PUBLIC_SELECT,
  });
  const after = { nome: updated.nome, ativo: updated.ativo };

  const changed = buildDiff(before, after, DIFFABLE, data);

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: data.ativo === false ? "DEPOSITO_DEACTIVATED" : "DEPOSITO_UPDATED",
      target: updated.id,
      details: JSON.stringify(changed),
      ipAddress: req.ip || null,
    },
  });

  return reply.send({ deposito: updated });
};

export const deleteDepositoHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };

  const target = await prisma.deposito.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("Depósito não encontrado");

  if (target.ativo) {
    await prisma.deposito.update({ where: { id }, data: { ativo: false } });
  }

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "DEPOSITO_DEACTIVATED",
      target: id,
      ipAddress: req.ip || null,
    },
  });

  return reply.send({ message: "Depósito desativado" });
};
