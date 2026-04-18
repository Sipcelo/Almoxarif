import { FastifyReply, FastifyRequest } from "fastify";
import { createSaidaSchema, listSaidasQuerySchema } from "./saidas.schema";
import { createSaida, getSaidaOrFail, listSaidas } from "./saidas.service";

export const listSaidasHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const query = listSaidasQuerySchema.parse(req.query ?? {});
  const result = await listSaidas(query);
  return reply.send(result);
};

export const getSaidaHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const saida = await getSaidaOrFail(id);
  return reply.send({ saida });
};

export const createSaidaHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const data = createSaidaSchema.parse(req.body);
  const saida = await createSaida(data, req.user!.id, req.ip);
  return reply.status(201).send({ saida });
};
