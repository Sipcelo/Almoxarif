import { FastifyInstance } from "fastify";
import {
  listDepositosHandler,
  getDepositoHandler,
  createDepositoHandler,
  updateDepositoHandler,
  deleteDepositoHandler,
} from "./handlers";
import { requireAuth, requireRole } from "../../../shared/middleware/require-auth";

export async function depositosRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", listDepositosHandler);
  app.get("/:id", getDepositoHandler);

  app.post("/", { preHandler: requireRole(["admin"]) }, createDepositoHandler);
  app.put("/:id", { preHandler: requireRole(["admin"]) }, updateDepositoHandler);
  app.delete("/:id", { preHandler: requireRole(["admin"]) }, deleteDepositoHandler);
}
