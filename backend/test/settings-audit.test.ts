import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import {
  createApp,
  cleanDatabase,
  seedAdmin,
  seedSetor,
  loginAsAdmin,
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

describe("Settings/Funcionarios — auditoria", () => {
  it("SETOR_CREATED é registrado ao criar", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/settings/setores",
      headers: { cookie: adminCookie },
      payload: { nome: "auditado" },
    });
    expect(res.statusCode).toBe(201);
    const log = await prisma.auditLog.findFirst({
      where: { action: "SETOR_CREATED" },
    });
    expect(log).toBeTruthy();
    expect(log?.target).toBe(res.json().setor.id);
  });

  it("EMPLOYEE_CREATED e EMPLOYEE_DEACTIVATED são registrados", async () => {
    const s = await seedSetor("auditoria");
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/funcionarios",
      headers: { cookie: adminCookie },
      payload: { nome: "Funcionário Auditado", cargo: "Cargo", setorId: s.id },
    });
    expect(createRes.statusCode).toBe(201);
    const fid = createRes.json().funcionario.id;

    const delRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/funcionarios/${fid}`,
      headers: { cookie: adminCookie },
    });
    expect(delRes.statusCode).toBe(200);

    const created = await prisma.auditLog.findFirst({
      where: { action: "EMPLOYEE_CREATED", target: fid },
    });
    const deactivated = await prisma.auditLog.findFirst({
      where: { action: "EMPLOYEE_DEACTIVATED", target: fid },
    });
    expect(created).toBeTruthy();
    expect(deactivated).toBeTruthy();
  });
});
