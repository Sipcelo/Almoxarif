import { FastifyInstance } from "fastify";
import { prisma } from "./prisma";

const startedAt = Date.now();

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_req, reply) => {
    const body = {
      status: "ok",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      checks: { database: "connected" as "connected" | "unreachable" },
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      body.status = "degraded";
      body.checks.database = "unreachable";
      return reply.status(503).send(body);
    }

    return reply.send(body);
  });
}
