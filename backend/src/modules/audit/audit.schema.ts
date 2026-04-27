import { z } from "zod";

export const listAuditQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    action: z.string().trim().toUpperCase().optional(),
    userId: z.string().uuid().optional(),
    dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine(
    (d) => !(d.dataInicio && d.dataFim) || d.dataInicio <= d.dataFim,
    {
      message: "dataInicio deve ser anterior ou igual a dataFim",
      path: ["dataInicio"],
    }
  );

export type ListAuditQueryInput = z.infer<typeof listAuditQuerySchema>;
