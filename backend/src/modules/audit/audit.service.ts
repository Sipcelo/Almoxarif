import { Prisma } from "@prisma/client";
import { prisma } from "../../infra/prisma";
import { ListAuditQueryInput } from "./audit.schema";

function parseDetails(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function listAuditLogs(query: ListAuditQueryInput) {
  const where: Prisma.AuditLogWhereInput = {};

  if (query.action) where.action = query.action;
  if (query.userId) where.userId = query.userId;

  if (query.dataInicio || query.dataFim) {
    const filter: { gte?: Date; lte?: Date } = {};
    if (query.dataInicio) filter.gte = new Date(query.dataInicio);
    if (query.dataFim) {
      const end = new Date(query.dataFim);
      end.setHours(23, 59, 59, 999);
      filter.lte = end;
    }
    where.timestamp = filter;
  }

  const skip = (query.page - 1) * query.limit;

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        target: true,
        details: true,
        ipAddress: true,
        timestamp: true,
        user: { select: { id: true, nome: true, email: true } },
      },
      orderBy: { timestamp: "desc" },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    logs: logs.map((l) => ({ ...l, details: parseDetails(l.details) })),
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}
