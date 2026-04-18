import { z } from "zod";

const pageCoerce = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v : parseInt(v, 10)));

const money = z.number().finite().nonnegative();

export const createEntradaSchema = z
  .object({
    itemId: z.string().uuid("itemId deve ser UUID valido"),
    qtd: z.number().int().positive(),
    valorUnit: money,
    data: z.string().datetime().optional(),
    obs: z.string().trim().max(1000).nullable().optional(),
  })
  .strip();

export const listEntradasQuerySchema = z
  .object({
    itemId: z.string().uuid().optional(),
    dataInicio: z.string().datetime().optional(),
    dataFim: z.string().datetime().optional(),
    page: pageCoerce.pipe(z.number().int().min(1)).optional().default(1),
    limit: pageCoerce.pipe(z.number().int().min(1).max(100)).optional().default(20),
  })
  .strip();

export type CreateEntradaInput = z.infer<typeof createEntradaSchema>;
export type ListEntradasQueryInput = z.infer<typeof listEntradasQuerySchema>;
