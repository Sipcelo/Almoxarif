import { z } from "zod";

export const createFuncionarioSchema = z
  .object({
    nome: z.string().trim().min(2).max(100),
    cargo: z.string().trim().min(2).max(100),
    setorId: z.string().uuid("setorId deve ser UUID válido"),
  })
  .strip();

export const updateFuncionarioSchema = z
  .object({
    nome: z.string().trim().min(2).max(100).optional(),
    cargo: z.string().trim().min(2).max(100).optional(),
    setorId: z.string().uuid().optional(),
    ativo: z.boolean().optional(),
  })
  .strip()
  .refine(
    (v) =>
      v.nome !== undefined ||
      v.cargo !== undefined ||
      v.setorId !== undefined ||
      v.ativo !== undefined,
    { message: "Informe ao menos um campo para atualizar" }
  );

const pageCoerce = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v : parseInt(v, 10)));

export const listFuncionariosQuerySchema = z
  .object({
    ativo: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .transform((v) => (typeof v === "boolean" ? v : v === "true"))
      .optional(),
    setorId: z.string().uuid().optional(),
    search: z.string().trim().min(1).optional(),
    page: pageCoerce.pipe(z.number().int().min(1)).optional().default(1),
    limit: pageCoerce.pipe(z.number().int().min(1).max(100)).optional().default(20),
  })
  .strip();

export type CreateFuncionarioInput = z.infer<typeof createFuncionarioSchema>;
export type UpdateFuncionarioInput = z.infer<typeof updateFuncionarioSchema>;
