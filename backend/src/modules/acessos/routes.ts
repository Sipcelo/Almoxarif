import { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../../shared/middleware/require-auth";
import { createAcessoHandler, listAcessosHandler } from "./handlers";

export async function acessosRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.get("/", { preHandler: requireRole(["admin"]) }, listAcessosHandler);
  app.post("/", { preHandler: requireRole(["admin"]) }, createAcessoHandler);
}
