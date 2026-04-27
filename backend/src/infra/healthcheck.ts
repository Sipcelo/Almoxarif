import { FastifyInstance } from "fastify";
import { prisma } from "./prisma";

const startedAt = Date.now();

function serviceInfo() {
  return {
    service: "almox-backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startedAt) / 1000),
  };
}

async function readiness() {
  const body = {
    status: "ok",
    ...serviceInfo(),
    checks: { database: "connected" as "connected" | "unreachable" },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    body.status = "degraded";
    body.checks.database = "unreachable";
    return { statusCode: 503, body };
  }

  return { statusCode: 200, body };
}

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health/live", async () => ({
    status: "ok",
    ...serviceInfo(),
  }));

  app.get("/health/ready", async (_req, reply) => {
    const result = await readiness();
    return reply.status(result.statusCode).send(result.body);
  });

  app.get("/health", async (_req, reply) => {
    const result = await readiness();
    return reply.status(result.statusCode).send(result.body);
  });
}
