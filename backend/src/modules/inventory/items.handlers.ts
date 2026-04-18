import { FastifyReply, FastifyRequest } from "fastify";
import { createItemSchema, listItemsQuerySchema, updateItemSchema } from "./items.schema";
import { createItem, deactivateItem, getItemOrFail, listItems, updateItem } from "./items.service";
import { AppError } from "../../shared/errors/app-error";

export const listItemsHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const query = listItemsQuerySchema.parse(req.query ?? {});
  const result = await listItems(query);
  return reply.send(result);
};

export const getItemHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const item = await getItemOrFail(id);
  return reply.send({ item });
};

export const createItemHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const data = createItemSchema.parse(req.body);
  const item = await createItem(data, req.user!.id, req.ip);
  return reply.status(201).send({ item });
};

export const updateItemHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  if (req.body && typeof req.body === "object" && "quantidade" in (req.body as Record<string, unknown>)) {
    throw AppError.validation("Quantidade nao pode ser alterada por este endpoint");
  }
  const { id } = req.params as { id: string };
  const data = updateItemSchema.parse(req.body);
  const item = await updateItem(id, data, req.user!.id, req.ip);
  return reply.send({ item });
};

export const deleteItemHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  await deactivateItem(id, req.user!.id, req.ip);
  return reply.send({ message: "Item desativado" });
};
