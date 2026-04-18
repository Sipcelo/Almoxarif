import { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../../infra/prisma";
import { AppError } from "../../shared/errors/app-error";
import { buildDiff } from "../../shared/utils/diff";
import {
  createUserSchema,
  updateUserSchema,
  passwordSchema,
  listQuerySchema,
  UpdateUserInput,
} from "./users.schema";
import {
  assertNotLastActiveAdmin,
  assertNotSelfDemotionOrDeactivation,
  invalidateUserSessions,
  isDemotingOrDeactivatingAdmin,
} from "./guards";

const PUBLIC_SELECT = {
  id: true,
  nome: true,
  email: true,
  role: true,
  ativo: true,
  criadoEm: true,
} as const;

const DIFFABLE_FIELDS = ["nome", "email", "role", "ativo"] as const;

export const listUsersHandler = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  const q = listQuerySchema.parse(req.query ?? {});
  const where: Prisma.UserWhereInput = {};
  if (q.role) where.role = q.role;
  if (typeof q.ativo === "boolean") where.ativo = q.ativo;
  if (q.search) {
    where.OR = [
      { nome: { contains: q.search, mode: "insensitive" } },
      { email: { contains: q.search, mode: "insensitive" } },
    ];
  }

  const skip = (q.page - 1) * q.limit;
  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: PUBLIC_SELECT,
      orderBy: { criadoEm: "desc" },
      skip,
      take: q.limit,
    }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / q.limit);

  return reply.send({
    users,
    meta: { total, page: q.page, limit: q.limit, totalPages },
  });
};

export const getUserHandler = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  const { id } = req.params as { id: string };
  const user = await prisma.user.findUnique({
    where: { id },
    select: PUBLIC_SELECT,
  });
  if (!user) throw AppError.notFound("Usuário não encontrado");
  return reply.send({ user });
};

export const createUserHandler = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  const data = createUserSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw AppError.conflict("E-mail já cadastrado");

  const hashed = await bcrypt.hash(data.senha, 12);
  const user = await prisma.user.create({
    data: {
      nome: data.nome,
      email: data.email,
      senha: hashed,
      role: data.role,
    },
    select: PUBLIC_SELECT,
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "USER_CREATED",
      target: user.id,
      details: JSON.stringify({ nome: user.nome, email: user.email, role: user.role }),
      ipAddress: req.ip || null,
    },
  });

  return reply.status(201).send({ user });
};

export const updateUserHandler = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  const { id } = req.params as { id: string };
  const data: UpdateUserInput = updateUserSchema.parse(req.body);
  const actor = req.user!;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("Usuário não encontrado");

  if (data.email && data.email !== target.email) {
    const clash = await prisma.user.findUnique({ where: { email: data.email } });
    if (clash) throw AppError.conflict("E-mail já cadastrado");
  }

  assertNotSelfDemotionOrDeactivation(actor, target, data);

  if (isDemotingOrDeactivatingAdmin(target, data)) {
    await assertNotLastActiveAdmin();
  }

  const before = {
    nome: target.nome,
    email: target.email,
    role: target.role,
    ativo: target.ativo,
  };

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: PUBLIC_SELECT,
  });

  const after = {
    nome: updated.nome,
    email: updated.email,
    role: updated.role,
    ativo: updated.ativo,
  };

  const changed = buildDiff(before, after, DIFFABLE_FIELDS, data);

  const mustInvalidate =
    data.ativo === false || (data.role !== undefined && data.role !== target.role);
  if (mustInvalidate) {
    await invalidateUserSessions(target.id);
  }

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: data.ativo === false ? "USER_DEACTIVATED" : "USER_UPDATED",
      target: target.id,
      details: JSON.stringify(changed),
      ipAddress: req.ip || null,
    },
  });

  return reply.send({ user: updated });
};

export const changePasswordHandler = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  const { id } = req.params as { id: string };
  const { novaSenha } = passwordSchema.parse(req.body);

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("Usuário não encontrado");

  const hashed = await bcrypt.hash(novaSenha, 12);
  await prisma.user.update({ where: { id }, data: { senha: hashed } });

  await invalidateUserSessions(target.id);

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "PASSWORD_CHANGED",
      target: target.id,
      ipAddress: req.ip || null,
    },
  });

  return reply.send({ message: "Senha atualizada" });
};

export const deleteUserHandler = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  const { id } = req.params as { id: string };
  const actor = req.user!;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw AppError.notFound("Usuário não encontrado");

  if (actor.id === target.id) {
    throw AppError.conflict(
      "Administrador não pode desativar ou rebaixar a si mesmo"
    );
  }

  if (target.role === "admin" && target.ativo) {
    await assertNotLastActiveAdmin();
  }

  if (target.ativo) {
    await prisma.user.update({ where: { id }, data: { ativo: false } });
    await invalidateUserSessions(target.id);
  }

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "USER_DEACTIVATED",
      target: target.id,
      ipAddress: req.ip || null,
    },
  });

  return reply.send({ message: "Usuário desativado" });
};
