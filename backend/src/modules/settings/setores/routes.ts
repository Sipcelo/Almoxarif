import { FastifyInstance } from "fastify";
import {
  listSetoresHandler,
  getSetorHandler,
  createSetorHandler,
  updateSetorHandler,
  deleteSetorHandler,
} from "./handlers";
import { requireAuth, requireRole } from "../../../shared/middleware/require-auth";

export async function setoresRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get("/", listSetoresHandler);
  app.get("/:id", getSetorHandler);

  app.post("/", { preHandler: requireRole(["admin"]) }, createSetorHandler);
  app.put("/:id", { preHandler: requireRole(["admin"]) }, updateSetorHandler);
  app.delete("/:id", { preHandler: requireRole(["admin"]) }, deleteSetorHandler);
}
