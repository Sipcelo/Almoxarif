import { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../../shared/middleware/require-auth";
import { createEntradaHandler, getEntradaHandler, listEntradasHandler } from "./entradas.handlers";

export async function entradasRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", listEntradasHandler);
  app.get("/:id", getEntradaHandler);
  app.post("/", { preHandler: requireRole(["admin", "gerente", "operador"]) }, createEntradaHandler);
}
