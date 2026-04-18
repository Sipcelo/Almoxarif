import { z } from "zod";

const nome = z.string().trim().min(2).max(100);

export const createCategoriaSchema = z.object({ nome }).strip();

export const updateCategoriaSchema = z
  .object({
    nome: nome.optional(),
    ativo: z.boolean().optional(),
  })
  .strip()
  .refine((v) => v.nome !== undefined || v.ativo !== undefined, {
    message: "Informe ao menos um campo para atualizar",
  });

const pageCoerce = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v : parseInt(v, 10)));

export const listCategoriasQuerySchema = z
  .object({
    ativo: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .transform((v) => (typeof v === "boolean" ? v : v === "true"))
      .optional(),
    search: z.string().trim().min(1).optional(),
    page: pageCoerce.pipe(z.number().int().min(1)).optional().default(1),
    limit: pageCoerce.pipe(z.number().int().min(1).max(100)).optional().default(20),
  })
  .strip();

export type CreateCategoriaInput = z.infer<typeof createCategoriaSchema>;
export type UpdateCategoriaInput = z.infer<typeof updateCategoriaSchema>;
