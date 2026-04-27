import { z } from "zod";

export const periodoQuerySchema = z.object({
  periodo: z.coerce.number().int().min(1).max(365).default(30),
});

export type PeriodoQueryInput = z.infer<typeof periodoQuerySchema>;
