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
import { acessosRoutes } from "../modules/acessos/routes";
import { reportsRoutes } from "../modules/reports/reports.routes";
import { auditRoutes } from "../modules/audit/audit.routes";
import { healthRoutes } from "../infra/healthcheck";
import { securityHeaders } from "../infra/security-headers";
import { registerStaticFrontend } from "../infra/static-frontend";
import { registerShutdown } from "../infra/shutdown";
import { loggerOptions } from "../infra/logger-options";
import { errorHandler, notFoundHandler } from "../infra/error-handler";

function resolveCorsOrigins() {
  const defaults = [
    "http://localhost:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];
  const envOrigins = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return new Set([...defaults, ...envOrigins]);
}

export async function buildApp() {
  validateEnv();
  const allowedCorsOrigins = resolveCorsOrigins();

  const app = Fastify({
    logger: process.env.NODE_ENV !== "test" ? loggerOptions() : false,
  });

  await securityHeaders(app);

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || allowedCorsOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-almox-csrf"],
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
      await api.register(acessosRoutes, { prefix: "/acessos" });
      await api.register(reportsRoutes, { prefix: "/reports" });
      await api.register(auditRoutes, { prefix: "/audit" });
    },
    { prefix: "/api/v1" }
  );
  await registerStaticFrontend(app);

  return app;
}

if (require.main === module) {
  buildApp().then(async (app) => {
    const PORT = process.env.PORT || 3001;
    const HOST = process.env.HOST || "0.0.0.0";
    registerShutdown(app);
    await app.listen({ port: Number(PORT), host: HOST });
  });
}
