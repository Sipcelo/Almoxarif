import { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../../infra/prisma";
import { AppError } from "../../shared/errors/app-error";
import { buildDiff } from "../../shared/utils/diff";
import {
  createFuncionarioSchema,
  updateFuncionarioSchema,
  listFuncionariosQuerySchema,
} from "./funcionarios.schema";
import { assertSetorUsable } from "./guards";

const PUBLIC_SELECT = {
  id: true,
  nome: true,
  cargo: true,
  setorId: true,
  ativo: true,
  criadoEm: true,
  setor: { select: { id: true, nome: true, ativo: true } },
} as const;

const DIFFABLE = ["nome", "cargo", "setorId", "ativo"] as const;

export const listFuncionariosHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const q = listFuncionariosQuerySchema.parse(req.query ?? {});
  const where: Prisma.FuncionarioWhereInput = {};
  if (typeof q.ativo === "boolean") where.ativo = q.ativo;
  if (q.setorId) where.setorId = q.setorId;
  if (q.search) {
    where.OR = [
      { nome: { contains: q.search, mode: "insensitive" } },
      { cargo: { contains: q.search, mode: "insensitive" } },
    ];
  }

  const skip = (q.page - 1) * q.limit;
  const [total, funcionarios] = await prisma.$transaction([
    prisma.funcionario.count({ where }),
    prisma.funcionario.findMany({
      where,
      select: PUBLIC_SELECT,
      orderBy: { nome: "asc" },
      skip,
      take: q.limit,
    }),
  ]);

  return reply.send({
    funcionarios,
    meta: {
      total,
      page: q.page,
      limit: q.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / q.limit),
    },
  });
};

export const getFuncionarioHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const funcionario = await prisma.funcionario.findUnique({
    where: { id },
    select: PUBLIC_SELECT,
  });
  if (!funcionario) throw AppError.notFound("Funcionário não encontrado");
  return reply.send({ funcionario });
};

export const createFuncionarioHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const data = createFuncionarioSchema.parse(req.body);

  await assertSetorUsable(data.setorId);

  const funcionario = await prisma.funcionario.create({
    data: {
      nome: data.nome,
      cargo: data.cargo,
      setorId: data.setorId,
    },
    select: PUBLIC_SELECT,
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "EMPLOYEE_CREATED",
      target: funcionario.id,
      details: JSON.stringify({
        nome: funcionario.nome,
        cargo: funcionario.cargo,
        setorId: funcionario.setorId,
      }),
      ipAddress: req.ip || null,
    },
  });

  return reply.status(201).send({ funcionario });
};

export const updateFuncionarioHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const data = updateFuncionarioSchema.parse(req.body);

  const target = await prisma.funcionario.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("Funcionário não encontrado");

  if (data.setorId !== undefined && data.setorId !== target.setorId) {
    await assertSetorUsable(data.setorId);
  }

  const before = {
    nome: target.nome,
    cargo: target.cargo,
    setorId: target.setorId,
    ativo: target.ativo,
  };

  const updated = await prisma.funcionario.update({
    where: { id },
    data,
    select: PUBLIC_SELECT,
  });

  const after = {
    nome: updated.nome,
    cargo: updated.cargo,
    setorId: updated.setorId,
    ativo: updated.ativo,
  };

  const changed = buildDiff(before, after, DIFFABLE, data);

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: data.ativo === false ? "EMPLOYEE_DEACTIVATED" : "EMPLOYEE_UPDATED",
      target: updated.id,
      details: JSON.stringify(changed),
      ipAddress: req.ip || null,
    },
  });

  return reply.send({ funcionario: updated });
};

export const deleteFuncionarioHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };

  const target = await prisma.funcionario.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("Funcionário não encontrado");

  if (target.ativo) {
    await prisma.funcionario.update({ where: { id }, data: { ativo: false } });
  }

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "EMPLOYEE_DEACTIVATED",
      target: id,
      ipAddress: req.ip || null,
    },
  });

  return reply.send({ message: "Funcionário desativado" });
};
