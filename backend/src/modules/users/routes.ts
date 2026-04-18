import { FastifyInstance } from "fastify";
import {
  listUsersHandler,
  getUserHandler,
  createUserHandler,
  updateUserHandler,
  changePasswordHandler,
  deleteUserHandler,
} from "./handlers";
import { requireAuth, requireRole } from "../../shared/middleware/require-auth";

export async function userRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireRole(["admin"]));

  app.get("/", listUsersHandler);
  app.get("/:id", getUserHandler);
  app.post("/", createUserHandler);
  app.put("/:id", updateUserHandler);
  app.patch("/:id/password", changePasswordHandler);
  app.delete("/:id", deleteUserHandler);
}
