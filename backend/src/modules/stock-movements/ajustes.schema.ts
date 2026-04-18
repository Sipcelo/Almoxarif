import { z } from "zod";

const pageCoerce = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v : parseInt(v, 10)));

export const createAjusteSchema = z
  .object({
    itemId: z.string().uuid("itemId deve ser UUID valido"),
    qtdNova: z.number().int().nonnegative(),
    motivo: z.string().trim().min(5).max(500),
    obs: z.string().trim().max(1000).nullable().optional(),
  })
  .strip();

export const listAjustesQuerySchema = z
  .object({
    itemId: z.string().uuid().optional(),
    dataInicio: z.string().datetime().optional(),
    dataFim: z.string().datetime().optional(),
    page: pageCoerce.pipe(z.number().int().min(1)).optional().default(1),
    limit: pageCoerce.pipe(z.number().int().min(1).max(100)).optional().default(20),
  })
  .strip();

export type CreateAjusteInput = z.infer<typeof createAjusteSchema>;
export type ListAjustesQueryInput = z.infer<typeof listAjustesQuerySchema>;
