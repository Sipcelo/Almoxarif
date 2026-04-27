import { z } from "zod";

const pageCoerce = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v : parseInt(v, 10)));

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve estar no formato YYYY-MM-DD");
const hourOnly = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "hora deve estar no formato HH:mm");

export const createAcessoSchema = z
  .object({
    nome: z.string().trim().min(2, "nome deve ter no minimo 2 caracteres").max(160),
    tipo: z.enum(["Entrada", "Saida"]),
    hora: hourOnly,
    data: dateOnly,
    cargo: z.string().trim().max(120).nullable().optional(),
  })
  .strip();

export const listAcessosQuerySchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    tipo: z.enum(["Entrada", "Saida"]).optional(),
    dataInicio: dateOnly.optional(),
    dataFim: dateOnly.optional(),
    page: pageCoerce.pipe(z.number().int().min(1)).optional().default(1),
    limit: pageCoerce.pipe(z.number().int().min(1).max(100)).optional().default(20),
  })
  .strip();

export type CreateAcessoInput = z.infer<typeof createAcessoSchema>;
export type ListAcessosQueryInput = z.infer<typeof listAcessosQuerySchema>;
