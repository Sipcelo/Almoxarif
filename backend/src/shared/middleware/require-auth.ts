import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../infra/prisma";
import { AppError } from "../errors/app-error";
import { Role } from "../types";
import {
  COOKIE_NAME,
  TTL_MS,
  clearSessionCookie,
} from "../../config/session";
import { requireCsrf } from "./require-csrf";

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const sid = req.cookies?.[COOKIE_NAME];
  if (!sid) {
    throw AppError.unauthorized();
  }

  const session = await prisma.session.findUnique({
    where: { id: sid },
    include: { user: true },
  });

  if (!session) {
    clearSessionCookie(reply);
    throw AppError.unauthorized();
  }

  if (session.expiresAt.getTime() < Date.now()) {
    try {
      await prisma.session.delete({ where: { id: sid } });
    } catch (err) {
      req.log.warn({ err, sid }, "expired session cleanup failed");
    }
    clearSessionCookie(reply);
    throw AppError.unauthorized();
  }

  if (!session.user.ativo) {
    try {
      await prisma.session.deleteMany({ where: { userId: session.userId } });
    } catch (err) {
      req.log.warn(
        { err, userId: session.userId },
        "inactive user session cleanup failed"
      );
    }
    clearSessionCookie(reply);
    throw AppError.unauthorized();
  }

  const newExpires = new Date(Date.now() + TTL_MS);
  await prisma.session.update({
    where: { id: sid },
    data: { expiresAt: newExpires },
  });

  req.sessionId = sid;
  req.sessionCsrfToken = session.csrfToken;
  req.user = {
    id: session.user.id,
    nome: session.user.nome,
    email: session.user.email,
    role: session.user.role as Role,
  };

  await requireCsrf(req, reply);
}

export function requireRole(roles: Role[]) {
  return async function (req: FastifyRequest, _reply: FastifyReply) {
    if (!req.user) {
      throw AppError.unauthorized();
    }
    if (!roles.includes(req.user.role)) {
      throw AppError.forbidden();
    }
  };
}
