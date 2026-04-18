import { FastifyInstance } from "fastify";
import {
  listCategoriasHandler,
  getCategoriaHandler,
  createCategoriaHandler,
  updateCategoriaHandler,
  deleteCategoriaHandler,
} from "./handlers";
import { requireAuth, requireRole } from "../../../shared/middleware/require-auth";

export async function categoriasRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", listCategoriasHandler);
  app.get("/:id", getCategoriaHandler);

  app.post("/", { preHandler: requireRole(["admin"]) }, createCategoriaHandler);
  app.put("/:id", { preHandler: requireRole(["admin"]) }, updateCategoriaHandler);
  app.delete("/:id", { preHandler: requireRole(["admin"]) }, deleteCategoriaHandler);
}
