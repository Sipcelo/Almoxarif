import { FastifyReply, FastifyRequest } from "fastify";
import { createEntradaSchema, listEntradasQuerySchema } from "./entradas.schema";
import { createEntrada, getEntradaOrFail, listEntradas } from "./entradas.service";

export const listEntradasHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const query = listEntradasQuerySchema.parse(req.query ?? {});
  const result = await listEntradas(query);
  return reply.send(result);
};

export const getEntradaHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const entrada = await getEntradaOrFail(id);
  return reply.send({ entrada });
};

export const createEntradaHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const data = createEntradaSchema.parse(req.body);
  const entrada = await createEntrada(data, req.user!.id, req.ip);
  return reply.status(201).send({ entrada });
};
