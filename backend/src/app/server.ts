import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { validateEnv } from "../config/env";
import { authRoutes } from "../modules/auth/routes";
import { userRoutes } from "../modules/users/routes";
import { funcionariosRoutes } from "../modules/funcionarios/routes";
import { setoresRoutes } from "../modules/settings/setores/routes";
import { categoriasRoutes } from "../modules/settings/categorias/routes";
import { depositosRoutes } from "../modules/settings/depositos/routes";
import { itemsRoutes } from "../modules/inventory/items.routes";
import { entradasRoutes } from "../modules/stock-movements/entradas.routes";
import { saidasRoutes } from "../modules/stock-movements/saidas.routes";
import { ajustesRoutes } from "../modules/stock-movements/ajustes.routes";
import { healthRoutes } from "../infra/healthcheck";
import { errorHandler, notFoundHandler } from "../infra/error-handler";

export async function buildApp() {
  validateEnv();

  const app = Fastify({
    logger:
      process.env.NODE_ENV !== "test"
        ? {
            level: process.env.LOG_LEVEL || "info",
            redact: {
              paths: [
                "req.headers.cookie",
                "req.headers.authorization",
                'req.body.senha',
                'req.body.password',
                'req.body.novaSenha',
                "res.headers['set-cookie']",
              ],
              censor: "[REDACTED]",
            },
          }
        : false,
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || "http://localhost:8080",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    global: true,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    timeWindow: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  // CSRF: double-submit token (x-almox-csrf header vs session.csrfToken).
  // Applied via requireAuth pipeline — routes using requireAuth automatically
  // enforce CSRF on mutating methods (POST/PUT/PATCH/DELETE).
  // Exempt: /auth/login and /health (no requireAuth).

  await app.register(healthRoutes);
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: "/auth" });
      await api.register(userRoutes, { prefix: "/users" });
      await api.register(funcionariosRoutes, { prefix: "/funcionarios" });
      await api.register(setoresRoutes, { prefix: "/settings/setores" });
      await api.register(categoriasRoutes, { prefix: "/settings/categorias" });
      await api.register(depositosRoutes, { prefix: "/settings/depositos" });
      await api.register(itemsRoutes, { prefix: "/items" });
      await api.register(entradasRoutes, { prefix: "/entradas" });
      await api.register(saidasRoutes, { prefix: "/saidas" });
      await api.register(ajustesRoutes, { prefix: "/ajustes" });
    },
    { prefix: "/api/v1" }
  );

  return app;
}

if (require.main === module) {
  buildApp().then(async (app) => {
    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || "0.0.0.0";
    await app.listen({ port: Number(PORT), host: HOST });
  });
}
