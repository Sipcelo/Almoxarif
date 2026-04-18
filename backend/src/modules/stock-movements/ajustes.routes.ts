import { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../../shared/middleware/require-auth";
import { createAjusteHandler, getAjusteHandler, listAjustesHandler } from "./ajustes.handlers";

export async function ajustesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", { preHandler: requireRole(["admin", "gerente"]) }, listAjustesHandler);
  app.get("/:id", { preHandler: requireRole(["admin", "gerente"]) }, getAjusteHandler);
  app.post("/", { preHandler: requireRole(["admin"]) }, createAjusteHandler);
}
