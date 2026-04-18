import { FastifyInstance } from "fastify";
import { loginHandler, logoutHandler, meHandler } from "./handlers";
import { requireAuth } from "../../shared/middleware/require-auth";

export async function authRoutes(app: FastifyInstance) {
  const loginMax = Number(process.env.LOGIN_RATE_LIMIT_MAX) || 5;
  const loginWindow =
    Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

  app.post("/login", {
    config: {
      rateLimit: {
        max: loginMax,
        timeWindow: loginWindow,
      },
    },
    handler: loginHandler,
  });

  app.post("/logout", { preHandler: requireAuth, handler: logoutHandler });
  app.get("/me", { preHandler: requireAuth, handler: meHandler });
}
