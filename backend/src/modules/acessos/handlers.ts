import { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../../infra/prisma";
import { createAcessoSchema, listAcessosQuerySchema } from "./acessos.schema";

const ACESSO_SELECT = {
  id: true,
  nome: true,
  tipo: true,
  hora: true,
  data: true,
  cargo: true,
  criadoEm: true,
} as const;

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnly(value: Date): string {
  return value.toISOString().split("T")[0];
}

function toPublicAcesso(acesso: {
  id: string;
  nome: string;
  tipo: string;
  hora: string;
  data: Date;
  cargo: string | null;
  criadoEm: Date;
}) {
  return {
    ...acesso,
    data: formatDateOnly(acesso.data),
  };
}

export const listAcessosHandler = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  const q = listAcessosQuerySchema.parse(req.query ?? {});
  const where: Prisma.AcessoWhereInput = {};

  if (q.q) {
    where.OR = [
      { nome: { contains: q.q, mode: "insensitive" } },
      { cargo: { contains: q.q, mode: "insensitive" } },
      { tipo: { contains: q.q, mode: "insensitive" } },
    ];
  }

  if (q.tipo) where.tipo = q.tipo;

  if (q.dataInicio || q.dataFim) {
    where.data = {};
    if (q.dataInicio) where.data.gte = parseDateOnly(q.dataInicio);
    if (q.dataFim) where.data.lte = parseDateOnly(q.dataFim);
  }

  const skip = (q.page - 1) * q.limit;
  const [total, acessos] = await prisma.$transaction([
    prisma.acesso.count({ where }),
    prisma.acesso.findMany({
      where,
      select: ACESSO_SELECT,
      orderBy: [{ data: "desc" }, { hora: "desc" }, { criadoEm: "desc" }],
      skip,
      take: q.limit,
    }),
  ]);

  return reply.send({
    acessos: acessos.map(toPublicAcesso),
    meta: {
      total,
      page: q.page,
      limit: q.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / q.limit),
    },
  });
};

export const createAcessoHandler = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  const data = createAcessoSchema.parse(req.body);

  const acesso = await prisma.acesso.create({
    data: {
      nome: data.nome,
      tipo: data.tipo,
      hora: data.hora,
      data: parseDateOnly(data.data),
      cargo: data.cargo?.trim() || null,
      responsavelUserId: req.user!.id,
    },
    select: ACESSO_SELECT,
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user!.id,
      action: "ACESSO_CREATED",
      target: acesso.id,
      details: JSON.stringify({
        nome: acesso.nome,
        tipo: acesso.tipo,
        hora: acesso.hora,
        data: formatDateOnly(acesso.data),
        cargo: acesso.cargo,
      }),
      ipAddress: req.ip || null,
    },
  });

  return reply.status(201).send({ acesso: toPublicAcesso(acesso) });
};
