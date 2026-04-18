import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEEDS = [
  {
    nome: "Administrador",
    email: "admin@rodoviariapel.com",
    senha: "admin2026",
    role: "admin",
  },
  {
    nome: "Operador",
    email: "op@rodoviariapel.com",
    senha: "operador2026",
    role: "operador",
  },
];

async function main() {
  if (process.env.SEED_ENABLED !== "true") {
    console.log("[seed] SEED_ENABLED!=true — pulando.");
    return;
  }

  const SETORES = ["almoxarifado"];
  const CATEGORIAS = ["geral"];
  const DEPOSITOS = ["principal"];

  for (const nome of SETORES) {
    const existing = await prisma.setor.findUnique({ where: { nome } });
    if (!existing) {
      await prisma.setor.create({ data: { nome } });
      console.log(`[seed] setor criado: ${nome}`);
    }
  }
  for (const nome of CATEGORIAS) {
    const existing = await prisma.categoria.findUnique({ where: { nome } });
    if (!existing) {
      await prisma.categoria.create({ data: { nome } });
      console.log(`[seed] categoria criada: ${nome}`);
    }
  }
  for (const nome of DEPOSITOS) {
    const existing = await prisma.deposito.findUnique({ where: { nome } });
    if (!existing) {
      await prisma.deposito.create({ data: { nome } });
      console.log(`[seed] deposito criado: ${nome}`);
    }
  }

  for (const s of SEEDS) {
    const existing = await prisma.user.findUnique({ where: { email: s.email } });
    if (existing) {
      console.log(`[seed] já existe: ${s.email}`);
      continue;
    }
    const hashed = await bcrypt.hash(s.senha, 12);
    const user = await prisma.user.create({
      data: { nome: s.nome, email: s.email, senha: hashed, role: s.role },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_CREATED",
        target: user.id,
        details: JSON.stringify({ source: "seed", email: s.email, role: s.role }),
      },
    });
    console.log(`[seed] criado: ${s.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
