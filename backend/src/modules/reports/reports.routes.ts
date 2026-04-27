import { FastifyInstance } from "fastify";
import { requireAuth } from "../../shared/middleware/require-auth";
import {
  getMetricasHandler,
  getMovimentacoesHandler,
  getPorSetorHandler,
  getEstoqueHandler,
} from "./reports.handlers";

export async function reportsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.get("/metricas", getMetricasHandler);
  app.get("/movimentacoes", getMovimentacoesHandler);
  app.get("/por-setor", getPorSetorHandler);
  app.get("/estoque", getEstoqueHandler);
}
