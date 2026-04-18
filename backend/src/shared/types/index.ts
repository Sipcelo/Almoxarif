export type Role = "admin" | "gerente" | "operador" | "visitante";

export interface SessionUser {
  id: string;
  nome: string;
  email: string;
  role: Role;
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "CSRF_ERROR"
  | "INTERNAL_ERROR";

declare module "fastify" {
  interface FastifyRequest {
    user?: SessionUser;
    sessionId?: string;
    sessionCsrfToken?: string;
  }
}
