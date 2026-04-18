import { z } from "zod";

const pageCoerce = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v : parseInt(v, 10)));

const money = z.number().finite().nonnegative();

export const createSaidaSchema = z
  .object({
    itemId: z.string().uuid("itemId deve ser UUID valido"),
    qtd: z.number().int().positive(),
    valorUnit: money,
    funcionarioId: z.string().uuid("funcionarioId deve ser UUID valido"),
    data: z.string().datetime().optional(),
    obs: z.string().trim().max(1000).nullable().optional(),
  })
  .strip();

export const listSaidasQuerySchema = z
  .object({
    itemId: z.string().uuid().optional(),
    dataInicio: z.string().datetime().optional(),
    dataFim: z.string().datetime().optional(),
    page: pageCoerce.pipe(z.number().int().min(1)).optional().default(1),
    limit: pageCoerce.pipe(z.number().int().min(1).max(100)).optional().default(20),
  })
  .strip();

export type CreateSaidaInput = z.infer<typeof createSaidaSchema>;
export type ListSaidasQueryInput = z.infer<typeof listSaidasQuerySchema>;
