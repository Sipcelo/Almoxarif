import type { FastifyRequest, FastifyReply } from "fastify";
import { AppError } from "../errors/app-error";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_HEADER = "x-almox-csrf";

export async function requireCsrf(
  req: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (!MUTATING_METHODS.has(req.method)) return;

  const sessionUser = req.user;
  const sessionCsrf = req.sessionCsrfToken;

  if (!sessionUser || !sessionCsrf) {
    throw AppError.unauthorized();
  }

  const headerToken = req.headers[CSRF_HEADER];
  if (typeof headerToken !== "string" || headerToken.length === 0) {
    throw new AppError("CSRF_ERROR", "Token CSRF ausente", 403);
  }

  if (headerToken !== sessionCsrf) {
    throw new AppError("CSRF_ERROR", "Token CSRF inválido", 403);
  }
}
