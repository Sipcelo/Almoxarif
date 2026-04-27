import { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../../shared/middleware/require-auth";
import { listAuditHandler } from "./audit.handlers";

export async function auditRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireRole(["admin"]));
  app.get("/", listAuditHandler);
}
