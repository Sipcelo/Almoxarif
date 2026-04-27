import { FastifyRequest, FastifyReply } from "fastify";
import { listAuditQuerySchema } from "./audit.schema";
import { listAuditLogs } from "./audit.service";

export const listAuditHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  const query = listAuditQuerySchema.parse(req.query ?? {});
  return reply.send(await listAuditLogs(query));
};
