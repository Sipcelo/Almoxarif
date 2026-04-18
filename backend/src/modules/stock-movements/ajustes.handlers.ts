import { FastifyReply, FastifyRequest } from "fastify";
import { createAjusteSchema, listAjustesQuerySchema } from "./ajustes.schema";
import { createAjuste, getAjusteOrFail, listAjustes } from "./ajustes.service";

export const listAjustesHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const query = listAjustesQuerySchema.parse(req.query ?? {});
  const result = await listAjustes(query);
  return reply.send(result);
};

export const getAjusteHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const ajuste = await getAjusteOrFail(id);
  return reply.send({ ajuste });
};

export const createAjusteHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const data = createAjusteSchema.parse(req.body);
  const ajuste = await createAjuste(data, req.user!.id, req.ip);
  return reply.status(201).send({ ajuste });
};
