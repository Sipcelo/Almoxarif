import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../shared/errors/app-error";
import { ErrorCode } from "../shared/types";

interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details: unknown[];
  };
}

function buildBody(code: ErrorCode, message: string, details: unknown[] = []): ErrorBody {
  return { error: { code, message, details } };
}

export function errorHandler(
  error: FastifyError | Error,
  _req: FastifyRequest,
  reply: FastifyReply
) {
  if (error instanceof AppError) {
    return reply
      .status(error.statusCode)
      .send(buildBody(error.code, error.message, error.details));
  }

  if (error instanceof ZodError) {
    const details = error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }));
    return reply
      .status(400)
      .send(buildBody("VALIDATION_ERROR", "Dados de entrada inválidos", details));
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return reply
        .status(409)
        .send(buildBody("CONFLICT", "Registro com valor único já existe"));
    }
    if (error.code === "P2003") {
      return reply
        .status(409)
        .send(
          buildBody(
            "CONFLICT",
            "Operação viola restrição de integridade referencial"
          )
        );
    }
    if (error.code === "P2025") {
      return reply
        .status(404)
        .send(buildBody("NOT_FOUND", "Recurso não encontrado"));
    }
  }

  const fe = error as FastifyError;

  if (fe.statusCode === 429 || fe.code === "FST_TOO_MANY_REQUESTS") {
    return reply
      .status(429)
      .send(
        buildBody(
          "RATE_LIMITED",
          "Limite de requisições excedido. Tente novamente em breve."
        )
      );
  }

  if (fe.statusCode === 404) {
    return reply
      .status(404)
      .send(buildBody("NOT_FOUND", fe.message || "Recurso não encontrado"));
  }

  if (fe.validation) {
    return reply
      .status(400)
      .send(buildBody("VALIDATION_ERROR", fe.message, fe.validation as unknown[]));
  }

  if (fe.statusCode && fe.statusCode >= 400 && fe.statusCode < 500) {
    return reply
      .status(fe.statusCode)
      .send(buildBody("VALIDATION_ERROR", fe.message || "Requisição inválida"));
  }

  return reply
    .status(500)
    .send(buildBody("INTERNAL_ERROR", "Erro interno do servidor"));
}

export function notFoundHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply
    .status(404)
    .send(buildBody("NOT_FOUND", "Rota não encontrada"));
}
