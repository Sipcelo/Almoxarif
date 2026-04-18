import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  seedCategoria,
  seedDeposito,
  seedSetor,
  seedFuncionario,
  loginAsAdmin,
  seedItem,
  getItemSaldo,
  prisma,
} from "./helpers";

let app: FastifyInstance;
let adminCookie: string;

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase();
  await seedAdmin();
  adminCookie = await loginAsAdmin(app);
});

describe("Stock concurrency", () => {
  it("duas saidas concorrentes que excedem saldo: no maximo uma efetiva", async () => {
    const categoria = await seedCategoria("geral");
    const deposito = await seedDeposito("principal");
    const setor = await seedSetor("almoxarifado");
    const funcionario = await seedFuncionario({ nome: "Fulano", cargo: "Aux", setorId: setor.id });
    const item = await seedItem({ codigo: "ITM-C1", categoriaId: categoria.id, depositoId: deposito.id, quantidade: 5 });

    const req = () =>
      app.inject({
        method: "POST",
        url: "/api/v1/saidas",
        headers: { cookie: adminCookie },
        payload: { itemId: item.id, funcionarioId: funcionario.id, qtd: 4, valorUnit: 10 },
      });

    const [r1, r2] = await Promise.all([req(), req()]);
    const successes = [r1.statusCode, r2.statusCode].filter((s) => s === 201).length;
    const conflicts = [r1.statusCode, r2.statusCode].filter((s) => s === 409).length;

    expect(successes).toBe(1);
    expect(conflicts).toBe(1);
    expect(await getItemSaldo(item.id)).toBe(1);
  });
});
