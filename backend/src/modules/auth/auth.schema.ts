import { z } from "zod";

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("E-mail inválido").max(255),
    senha: z.string().min(1, "Senha obrigatória").max(128),
  })
  .strip();

export type LoginInput = z.infer<typeof loginSchema>;
