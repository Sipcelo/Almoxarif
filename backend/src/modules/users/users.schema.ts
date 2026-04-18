import { z } from "zod";

const roleEnum = z.enum(["admin", "gerente", "operador", "visitante"]);

export const createUserSchema = z
  .object({
    nome: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(255),
    senha: z.string().min(8).max(128),
    role: roleEnum,
  })
  .strip();

export const updateUserSchema = z
  .object({
    nome: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().toLowerCase().email().max(255).optional(),
    role: roleEnum.optional(),
    ativo: z.boolean().optional(),
  })
  .strip();

export const passwordSchema = z
  .object({
    novaSenha: z.string().min(8).max(128),
  })
  .strip();

const pageCoerce = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v : parseInt(v, 10)));

export const listQuerySchema = z
  .object({
    role: roleEnum.optional(),
    ativo: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .transform((v) => (typeof v === "boolean" ? v : v === "true"))
      .optional(),
    search: z.string().trim().min(1).optional(),
    page: pageCoerce
      .pipe(z.number().int().min(1))
      .optional()
      .default(1),
    limit: pageCoerce
      .pipe(z.number().int().min(1).max(100))
      .optional()
      .default(20),
  })
  .strip();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
