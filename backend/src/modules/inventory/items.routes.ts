import { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../../shared/middleware/require-auth";
import {
  createItemHandler,
  deleteItemHandler,
  getItemHandler,
  listItemsHandler,
  updateItemHandler,
} from "./items.handlers";

export async function itemsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", listItemsHandler);
  app.get("/:id", getItemHandler);

  app.post("/", { preHandler: requireRole(["admin", "gerente", "operador"]) }, createItemHandler);
  app.put("/:id", { preHandler: requireRole(["admin", "gerente", "operador"]) }, updateItemHandler);
  app.delete("/:id", { preHandler: requireRole(["admin"]) }, deleteItemHandler);
}
