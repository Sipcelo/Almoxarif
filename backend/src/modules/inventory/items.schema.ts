import { z } from "zod";

const pageCoerce = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v : parseInt(v, 10)));

const money = z.number().finite().nonnegative();

export const createItemSchema = z
  .object({
    codigo: z.string().trim().min(1).max(50),
    descricao: z.string().trim().min(2).max(200),
    categoriaId: z.string().uuid("categoriaId deve ser UUID valido"),
    depositoId: z.string().uuid("depositoId deve ser UUID valido"),
    quantidade: z.number().int().nonnegative().optional().default(0),
    minimo: z.number().int().nonnegative().optional().default(0),
    valorAtual: money.optional().default(0),
    obs: z.string().trim().max(1000).nullable().optional(),
  })
  .strip();

export const updateItemSchema = z
  .object({
    codigo: z.string().trim().min(1).max(50).optional(),
    descricao: z.string().trim().min(2).max(200).optional(),
    categoriaId: z.string().uuid().optional(),
    depositoId: z.string().uuid().optional(),
    minimo: z.number().int().nonnegative().optional(),
    valorAtual: money.optional(),
    obs: z.string().trim().max(1000).nullable().optional(),
  })
  .strip()
  .refine(
    (v) =>
      v.codigo !== undefined ||
      v.descricao !== undefined ||
      v.categoriaId !== undefined ||
      v.depositoId !== undefined ||
      v.minimo !== undefined ||
      v.valorAtual !== undefined ||
      v.obs !== undefined,
    { message: "Informe ao menos um campo para atualizar" }
  );

export const listItemsQuerySchema = z
  .object({
    search: z.string().trim().min(1).optional(),
    categoriaId: z.string().uuid().optional(),
    depositoId: z.string().uuid().optional(),
    ativo: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .transform((v) => (typeof v === "boolean" ? v : v === "true"))
      .optional(),
    baixoEstoque: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .transform((v) => (typeof v === "boolean" ? v : v === "true"))
      .optional(),
    sortBy: z.enum(["codigo", "descricao", "criadoEm"]).optional().default("codigo"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
    page: pageCoerce.pipe(z.number().int().min(1)).optional().default(1),
    limit: pageCoerce.pipe(z.number().int().min(1).max(100)).optional().default(20),
  })
  .strip();

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ListItemsQueryInput = z.infer<typeof listItemsQuerySchema>;
