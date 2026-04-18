import { FastifyInstance } from "fastify";
import {
  listFuncionariosHandler,
  getFuncionarioHandler,
  createFuncionarioHandler,
  updateFuncionarioHandler,
  deleteFuncionarioHandler,
} from "./handlers";
import { requireAuth, requireRole } from "../../shared/middleware/require-auth";

export async function funcionariosRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", listFuncionariosHandler);
  app.get("/:id", getFuncionarioHandler);

  app.post("/", { preHandler: requireRole(["admin"]) }, createFuncionarioHandler);
  app.put("/:id", { preHandler: requireRole(["admin"]) }, updateFuncionarioHandler);
  app.delete("/:id", { preHandler: requireRole(["admin"]) }, deleteFuncionarioHandler);
}
