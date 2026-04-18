import { ErrorCode } from "../types";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: unknown[];

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details: unknown[] = []
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  static validation(message: string, details: unknown[] = []) {
    return new AppError("VALIDATION_ERROR", message, 400, details);
  }
  static unauthorized(message = "Sessão expirada ou inválida") {
    return new AppError("UNAUTHORIZED", message, 401);
  }
  static forbidden(message = "Sem permissão para esta ação") {
    return new AppError("FORBIDDEN", message, 403);
  }
  static notFound(message = "Recurso não encontrado") {
    return new AppError("NOT_FOUND", message, 404);
  }
  static conflict(message: string) {
    return new AppError("CONFLICT", message, 409);
  }
  static rateLimited(message = "Limite de requisições excedido. Tente novamente em breve.") {
    return new AppError("RATE_LIMITED", message, 429);
  }
  static internal(message = "Erro interno do servidor") {
    return new AppError("INTERNAL_ERROR", message, 500);
  }
}
