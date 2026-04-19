import { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../infra/prisma";
import { AppError } from "../../shared/errors/app-error";
import { loginSchema } from "./auth.schema";
import { Role } from "../../shared/types";
import {
  TTL_MS,
  setSessionCookie,
  clearSessionCookie,
  setCsrfCookie,
  clearCsrfCookie,
} from "../../config/session";

function ipOf(req: FastifyRequest): string | null {
  return req.ip || (req.headers["x-forwarded-for"] as string) || null;
}

export const loginHandler = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  const parsed = loginSchema.parse(req.body);
  const { email, senha } = parsed;

  const user = await prisma.user.findUnique({ where: { email } });
  const ip = ipOf(req);
  const ua = (req.headers["user-agent"] as string) || null;

  const genericFail = async () => {
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: "LOGIN_FAILED",
        target: email,
        ipAddress: ip,
      },
    });
    throw AppError.unauthorized("Credenciais inválidas");
  };

  if (!user) return genericFail();
  if (!user.ativo) return genericFail();

  const ok = await bcrypt.compare(senha, user.senha);
  if (!ok) return genericFail();

  const expiresAt = new Date(Date.now() + TTL_MS);
  const csrfToken = randomUUID();
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt,
      ipAddress: ip,
      userAgent: ua,
      csrfToken,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "LOGIN",
      target: user.id,
      ipAddress: ip,
    },
  });

  setSessionCookie(reply, session.id);
  setCsrfCookie(reply, csrfToken);

  return reply.send({
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role as Role,
    },
    csrfToken,
  });
};

export const logoutHandler = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  const sid = req.sessionId!;
  const userId = req.user!.id;

  try {
    await prisma.session.delete({ where: { id: sid } });
  } catch (err) {
    req.log.warn({ err, sid }, "session delete during logout failed");
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: "LOGOUT",
      target: userId,
      ipAddress: ipOf(req),
    },
  });

  clearSessionCookie(reply);
  clearCsrfCookie(reply);
  return reply.send({ message: "Sessão encerrada" });
};

export const meHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  return reply.send({
    user: req.user,
    csrfToken: req.sessionCsrfToken,
  });
};
