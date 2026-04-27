import { FastifyRequest, FastifyReply } from "fastify";
import { periodoQuerySchema } from "./reports.schema";
import { getMetricas, getMovimentacoes, getPorSetor, getEstoque } from "./reports.service";

export const getMetricasHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { periodo } = periodoQuerySchema.parse(req.query ?? {});
  return reply.send(await getMetricas(periodo));
};

export const getMovimentacoesHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { periodo } = periodoQuerySchema.parse(req.query ?? {});
  return reply.send(await getMovimentacoes(periodo));
};

export const getPorSetorHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { periodo } = periodoQuerySchema.parse(req.query ?? {});
  return reply.send(await getPorSetor(periodo));
};

export const getEstoqueHandler = async (_req: FastifyRequest, reply: FastifyReply) => {
  return reply.send(await getEstoque());
};
