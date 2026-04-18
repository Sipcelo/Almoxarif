import { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../../shared/middleware/require-auth";
import { createSaidaHandler, getSaidaHandler, listSaidasHandler } from "./saidas.handlers";

export async function saidasRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", listSaidasHandler);
  app.get("/:id", getSaidaHandler);
  app.post("/", { preHandler: requireRole(["admin", "gerente", "operador"]) }, createSaidaHandler);
}
