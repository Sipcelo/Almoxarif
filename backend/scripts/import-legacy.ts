import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

type EntityName =
  | "setores"
  | "categorias"
  | "depositos"
  | "funcionarios"
  | "users"
  | "items"
  | "entradas"
  | "saidas";

type EntityReport = { created: number; skipped: number; failed: number };

type ImportReport = Record<EntityName, EntityReport> & {
  sourceFile: string;
  importedAt: string;
  warnings: string[];
};

type LegacyExport = z.infer<typeof legacyExportSchema>;

type LegacyRecord = Record<string, unknown>;

type NamedEntity = { id: string; nome: string };

type CliIO = {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

type RunOptions = {
  prismaClient: PrismaClient;
  env?: NodeJS.ProcessEnv;
};

const roleEnum = new Set(["admin", "gerente", "operador", "visitante"]);

const legacyExportSchema = z
  .object({
    users: z.array(z.record(z.any())).optional().default([]),
    items: z.array(z.record(z.any())).optional().default([]),
    entradas: z.array(z.record(z.any())).optional().default([]),
    saidas: z.array(z.record(z.any())).optional().default([]),
    funcionarios: z.array(z.record(z.any())).optional().default([]),
    setores: z.array(z.union([z.string(), z.record(z.any())])).optional().default([]),
    categorias: z.array(z.union([z.string(), z.record(z.any())])).optional().default([]),
    depositos: z.array(z.union([z.string(), z.record(z.any())])).optional().default([]),
    exportedAt: z.string().optional(),
  })
  .passthrough();

const emptyEntityReport = (): EntityReport => ({ created: 0, skipped: 0, failed: 0 });

function createReport(sourceFile: string): ImportReport {
  return {
    sourceFile,
    importedAt: new Date().toISOString(),
    warnings: [],
    setores: emptyEntityReport(),
    categorias: emptyEntityReport(),
    depositos: emptyEntityReport(),
    funcionarios: emptyEntityReport(),
    users: emptyEntityReport(),
    items: emptyEntityReport(),
    entradas: emptyEntityReport(),
    saidas: emptyEntityReport(),
  };
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeCode(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

function asBool(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return fallback;
}

function asInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  return Math.floor(n);
}

function asMoney(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseDate(value: unknown): Date | null {
  const raw = normalizeText(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T12:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function pushWarning(report: ImportReport, message: string): void {
  report.warnings.push(message);
}

function inc(report: ImportReport, entity: EntityName, field: keyof EntityReport): void {
  report[entity][field] += 1;
}

function ensureLegacyImportEnabled(env: NodeJS.ProcessEnv): void {
  if (env.ALLOW_LEGACY_IMPORT !== "true") {
    throw new Error("ALLOW_LEGACY_IMPORT=true e obrigatorio para executar importacao legacy.");
  }
}

async function readLegacyFile(filePath: string): Promise<LegacyExport> {
  const raw = await fs.readFile(filePath, "utf8");
  const cleaned = raw.replace(/^\uFEFF/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Arquivo JSON invalido para importacao legacy.");
  }
  return legacyExportSchema.parse(parsed);
}

function listNames(values: Array<string | LegacyRecord>): string[] {
  return values
    .map((entry) => {
      if (typeof entry === "string") return normalizeText(entry);
      if (entry && typeof entry === "object") {
        if ("nome" in entry) return normalizeText(entry.nome);
      }
      return "";
    })
    .filter((name) => Boolean(name));
}

function asRecords(values: LegacyRecord[]): LegacyRecord[] {
  return values.filter((value) => value && typeof value === "object");
}

function entradaIdentityKey(input: {
  itemId: string;
  qtd: number;
  valorUnit: number;
  data: Date;
  responsavelUserId: string;
  obs: string | null;
}): string {
  return [
    input.itemId,
    input.qtd,
    input.valorUnit.toFixed(2),
    dateKey(input.data),
    input.responsavelUserId,
    normalizeKey(input.obs),
  ].join("|");
}

function saidaIdentityKey(input: {
  itemId: string;
  funcionarioId: string;
  setorSnapshotNome: string;
  qtd: number;
  valorUnit: number;
  data: Date;
  responsavelUserId: string;
  obs: string | null;
}): string {
  return [
    input.itemId,
    input.funcionarioId,
    normalizeKey(input.setorSnapshotNome),
    input.qtd,
    input.valorUnit.toFixed(2),
    dateKey(input.data),
    input.responsavelUserId,
    normalizeKey(input.obs),
  ].join("|");
}

async function createLegacyAudit(
  tx: Prisma.TransactionClient,
  entity: EntityName,
  targetId: string,
  details: Record<string, unknown>
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: null,
      action: "LEGACY_IMPORT",
      target: `${entity}:${targetId}`,
      details: JSON.stringify({ actor: "SYSTEM", ...details }),
      ipAddress: null,
    },
  });
}

export async function runLegacyImport(filePath: string, options: RunOptions): Promise<ImportReport> {
  const env = options.env ?? process.env;
  ensureLegacyImportEnabled(env);

  const resolvedPath = path.resolve(filePath);
  const payload = await readLegacyFile(resolvedPath);
  const report = createReport(resolvedPath);

  await options.prismaClient.$transaction(async (tx) => {
    const setorMap = new Map<string, NamedEntity>();
    const categoriaMap = new Map<string, NamedEntity>();
    const depositoMap = new Map<string, NamedEntity>();
    const funcionarioMap = new Map<string, { id: string; nome: string; setorId: string }>();
    const userByEmail = new Map<string, { id: string; nome: string; email: string }>();
    const userLookup = new Map<string, { id: string; nome: string; email: string }>();
    const itemByCodigo = new Map<string, { id: string; codigo: string }>();
    const legacyItemIdMap = new Map<string, string>();
    const legacyFuncionarioIdMap = new Map<string, string>();

    const existingSetores = await tx.setor.findMany({ select: { id: true, nome: true } });
    existingSetores.forEach((row) => setorMap.set(normalizeKey(row.nome), row));

    const existingCategorias = await tx.categoria.findMany({ select: { id: true, nome: true } });
    existingCategorias.forEach((row) => categoriaMap.set(normalizeKey(row.nome), row));

    const existingDepositos = await tx.deposito.findMany({ select: { id: true, nome: true } });
    existingDepositos.forEach((row) => depositoMap.set(normalizeKey(row.nome), row));

    const existingFuncionarios = await tx.funcionario.findMany({
      select: { id: true, nome: true, setorId: true },
    });
    existingFuncionarios.forEach((row) => funcionarioMap.set(normalizeKey(row.nome), row));

    const existingUsers = await tx.user.findMany({ select: { id: true, nome: true, email: true } });
    existingUsers.forEach((row) => {
      const emailKey = normalizeKey(row.email);
      userByEmail.set(emailKey, row);
      userLookup.set(emailKey, row);
      userLookup.set(normalizeKey(row.nome), row);
    });

    const existingItems = await tx.item.findMany({ select: { id: true, codigo: true } });
    existingItems.forEach((row) => itemByCodigo.set(normalizeCode(row.codigo), row));

    const ensureSetor = async (nomeRaw: unknown, track = false): Promise<NamedEntity | null> => {
      const nome = normalizeText(nomeRaw);
      if (!nome) return null;
      const key = normalizeKey(nome);
      const existing = setorMap.get(key);
      if (existing) {
        if (track) inc(report, "setores", "skipped");
        return existing;
      }
      try {
        const created = await tx.setor.create({ data: { nome } });
        const mapped = { id: created.id, nome: created.nome };
        setorMap.set(key, mapped);
        if (track) inc(report, "setores", "created");
        await createLegacyAudit(tx, "setores", created.id, { nome: created.nome });
        return mapped;
      } catch (error) {
        if (track) inc(report, "setores", "failed");
        pushWarning(report, `Falha ao importar setor "${nome}": ${String(error)}`);
        return null;
      }
    };

    const ensureCategoria = async (nomeRaw: unknown, track = false): Promise<NamedEntity | null> => {
      const nome = normalizeText(nomeRaw);
      if (!nome) return null;
      const key = normalizeKey(nome);
      const existing = categoriaMap.get(key);
      if (existing) {
        if (track) inc(report, "categorias", "skipped");
        return existing;
      }
      try {
        const created = await tx.categoria.create({ data: { nome } });
        const mapped = { id: created.id, nome: created.nome };
        categoriaMap.set(key, mapped);
        if (track) inc(report, "categorias", "created");
        await createLegacyAudit(tx, "categorias", created.id, { nome: created.nome });
        return mapped;
      } catch (error) {
        if (track) inc(report, "categorias", "failed");
        pushWarning(report, `Falha ao importar categoria "${nome}": ${String(error)}`);
        return null;
      }
    };

    const ensureDeposito = async (nomeRaw: unknown, track = false): Promise<NamedEntity | null> => {
      const nome = normalizeText(nomeRaw);
      if (!nome) return null;
      const key = normalizeKey(nome);
      const existing = depositoMap.get(key);
      if (existing) {
        if (track) inc(report, "depositos", "skipped");
        return existing;
      }
      try {
        const created = await tx.deposito.create({ data: { nome } });
        const mapped = { id: created.id, nome: created.nome };
        depositoMap.set(key, mapped);
        if (track) inc(report, "depositos", "created");
        await createLegacyAudit(tx, "depositos", created.id, { nome: created.nome });
        return mapped;
      } catch (error) {
        if (track) inc(report, "depositos", "failed");
        pushWarning(report, `Falha ao importar deposito "${nome}": ${String(error)}`);
        return null;
      }
    };

    const setorNames = listNames(payload.setores as Array<string | LegacyRecord>);
    for (const nome of setorNames) {
      if (!nome) {
        inc(report, "setores", "failed");
        pushWarning(report, "Setor invalido no payload legacy.");
        continue;
      }
      await ensureSetor(nome, true);
    }

    const categoriaNames = listNames(payload.categorias as Array<string | LegacyRecord>);
    for (const nome of categoriaNames) {
      if (!nome) {
        inc(report, "categorias", "failed");
        pushWarning(report, "Categoria invalida no payload legacy.");
        continue;
      }
      await ensureCategoria(nome, true);
    }

    const depositoNames = listNames(payload.depositos as Array<string | LegacyRecord>);
    for (const nome of depositoNames) {
      if (!nome) {
        inc(report, "depositos", "failed");
        pushWarning(report, "Deposito invalido no payload legacy.");
        continue;
      }
      await ensureDeposito(nome, true);
    }

    const funcionarioRows = asRecords(payload.funcionarios as LegacyRecord[]);
    for (const raw of funcionarioRows) {
      const nome = normalizeText(raw.nome);
      if (!nome) {
        inc(report, "funcionarios", "failed");
        pushWarning(report, "Funcionario sem nome ignorado.");
        continue;
      }

      const key = normalizeKey(nome);
      const existing = funcionarioMap.get(key);
      if (existing) {
        inc(report, "funcionarios", "skipped");
        const legacyId = normalizeText(raw.id);
        if (legacyId) legacyFuncionarioIdMap.set(legacyId, existing.id);
        continue;
      }

      const setorNome = normalizeText(raw.setor || raw.setorNome || "Sem setor");
      const setor = await ensureSetor(setorNome || "Sem setor");
      if (!setor) {
        inc(report, "funcionarios", "failed");
        pushWarning(report, `Funcionario "${nome}" sem setor valido.`);
        continue;
      }

      const cargo = normalizeText(raw.cargo) || "Nao informado";
      try {
        const created = await tx.funcionario.create({
          data: {
            nome,
            cargo,
            setorId: setor.id,
            ativo: asBool(raw.ativo, true),
          },
          select: { id: true, nome: true, setorId: true },
        });
        funcionarioMap.set(key, created);
        const legacyId = normalizeText(raw.id);
        if (legacyId) legacyFuncionarioIdMap.set(legacyId, created.id);
        inc(report, "funcionarios", "created");
        await createLegacyAudit(tx, "funcionarios", created.id, {
          nome: created.nome,
          setorId: created.setorId,
        });
      } catch (error) {
        inc(report, "funcionarios", "failed");
        pushWarning(report, `Falha ao importar funcionario "${nome}": ${String(error)}`);
      }
    }

    const userRows = asRecords(payload.users as LegacyRecord[]);
    for (const raw of userRows) {
      const email = normalizeKey(raw.email);
      if (!email) {
        inc(report, "users", "failed");
        pushWarning(report, "Usuario sem email ignorado.");
        continue;
      }

      const existing = userByEmail.get(email);
      if (existing) {
        inc(report, "users", "skipped");
        continue;
      }

      const nome = normalizeText(raw.nome) || email;
      const senhaPlana = normalizeText(raw.senha) || "senha12345";
      const roleRaw = normalizeText(raw.role).toLowerCase();
      const role = roleEnum.has(roleRaw) ? roleRaw : "operador";

      try {
        const senha = await bcrypt.hash(senhaPlana, 12);
        const created = await tx.user.create({
          data: {
            nome,
            email,
            senha,
            role,
            ativo: asBool(raw.ativo, true),
          },
          select: { id: true, nome: true, email: true },
        });
        userByEmail.set(email, created);
        userLookup.set(email, created);
        userLookup.set(normalizeKey(created.nome), created);
        inc(report, "users", "created");
        await createLegacyAudit(tx, "users", created.id, { email: created.email, nome: created.nome });
      } catch (error) {
        inc(report, "users", "failed");
        pushWarning(report, `Falha ao importar usuario "${email}": ${String(error)}`);
      }
    }

    let fallbackUser = userLookup.get("legacy-import@almox.local");
    const ensureFallbackUser = async (): Promise<{ id: string; nome: string; email: string }> => {
      if (fallbackUser) return fallbackUser;
      const existing = userByEmail.get("legacy-import@almox.local");
      if (existing) {
        fallbackUser = existing;
        return existing;
      }
      const created = await tx.user.create({
        data: {
          nome: "Legacy Import",
          email: "legacy-import@almox.local",
          senha: await bcrypt.hash("legacy-import", 12),
          role: "admin",
          ativo: true,
        },
        select: { id: true, nome: true, email: true },
      });
      userByEmail.set(normalizeKey(created.email), created);
      userLookup.set(normalizeKey(created.email), created);
      userLookup.set(normalizeKey(created.nome), created);
      fallbackUser = created;
      return created;
    };

    const defaultUser =
      userByEmail.values().next().value ||
      (await ensureFallbackUser());

    const itemRows = asRecords(payload.items as LegacyRecord[]);
    for (const raw of itemRows) {
      const codigo = normalizeCode(raw.codigo);
      if (!codigo) {
        inc(report, "items", "failed");
        pushWarning(report, "Item sem codigo ignorado.");
        continue;
      }

      const existing = itemByCodigo.get(codigo);
      if (existing) {
        inc(report, "items", "skipped");
        const legacyId = normalizeText(raw.id);
        if (legacyId) legacyItemIdMap.set(legacyId, existing.id);
        continue;
      }

      const categoria =
        (await ensureCategoria(raw.categoria || raw.categoriaNome || "geral")) ||
        (await ensureCategoria("geral"));
      const deposito =
        (await ensureDeposito(raw.deposito || raw.depositoNome || "principal")) ||
        (await ensureDeposito("principal"));

      if (!categoria || !deposito) {
        inc(report, "items", "failed");
        pushWarning(report, `Item "${codigo}" sem categoria/deposito valido.`);
        continue;
      }

      const quantidade = asInt(raw.quantidade, 0);
      const minimo = asInt(raw.minimo, 0);
      const valor = asMoney(raw.valorAtual ?? raw.valor, 0);

      try {
        const created = await tx.item.create({
          data: {
            codigo,
            descricao: normalizeText(raw.descricao) || `Item ${codigo}`,
            categoriaId: categoria.id,
            depositoId: deposito.id,
            quantidade,
            minimo,
            valorAtual: new Prisma.Decimal(valor),
            obs: normalizeText(raw.obs) || null,
            ativo: asBool(raw.ativo, true),
          },
          select: { id: true, codigo: true },
        });
        itemByCodigo.set(codigo, created);
        const legacyId = normalizeText(raw.id);
        if (legacyId) legacyItemIdMap.set(legacyId, created.id);
        inc(report, "items", "created");
        await createLegacyAudit(tx, "items", created.id, { codigo: created.codigo });
      } catch (error) {
        inc(report, "items", "failed");
        pushWarning(report, `Falha ao importar item "${codigo}": ${String(error)}`);
      }
    }

    const existingEntradas = await tx.entrada.findMany({
      select: {
        itemId: true,
        qtd: true,
        valorUnit: true,
        data: true,
        responsavelUserId: true,
        obs: true,
      },
    });
    const entradaKeys = new Set(
      existingEntradas.map((row) =>
        entradaIdentityKey({
          itemId: row.itemId,
          qtd: row.qtd,
          valorUnit: Number(row.valorUnit),
          data: row.data,
          responsavelUserId: row.responsavelUserId,
          obs: row.obs,
        })
      )
    );

    const entradaRows = asRecords(payload.entradas as LegacyRecord[]);
    for (const raw of entradaRows) {
      const itemCode = normalizeCode(raw.itemCodigo);
      const legacyItemId = normalizeText(raw.itemId);
      const item =
        (itemCode ? itemByCodigo.get(itemCode) : undefined) ||
        (legacyItemId ? (() => {
          const mapped = legacyItemIdMap.get(legacyItemId);
          return mapped ? { id: mapped, codigo: itemCode || "" } : undefined;
        })() : undefined);

      if (!item) {
        inc(report, "entradas", "skipped");
        pushWarning(
          report,
          `Entrada ignorada: itemCodigo/itemId nao encontrado (${itemCode || legacyItemId || "sem referencia"}).`
        );
        continue;
      }

      const qtd = asInt(raw.qtd, 0);
      if (qtd <= 0) {
        inc(report, "entradas", "failed");
        pushWarning(report, `Entrada invalida para item ${itemCode || item.id}: qtd <= 0.`);
        continue;
      }

      const valorUnit = asMoney(raw.valorUnit, 0);
      const data = parseDate(raw.data) || new Date();
      const respKey = normalizeKey(raw.resp || raw.responsavel || "");
      const responsavel = userLookup.get(respKey) || defaultUser || (await ensureFallbackUser());
      const obs = normalizeText(raw.obs) || null;

      const identity = entradaIdentityKey({
        itemId: item.id,
        qtd,
        valorUnit,
        data,
        responsavelUserId: responsavel.id,
        obs,
      });
      if (entradaKeys.has(identity)) {
        inc(report, "entradas", "skipped");
        continue;
      }

      try {
        const created = await tx.entrada.create({
          data: {
            itemId: item.id,
            qtd,
            valorUnit: new Prisma.Decimal(valorUnit),
            data,
            responsavelUserId: responsavel.id,
            obs,
          },
          select: { id: true },
        });
        entradaKeys.add(identity);
        inc(report, "entradas", "created");
        await createLegacyAudit(tx, "entradas", created.id, {
          itemId: item.id,
          qtd,
          valorUnit: valorUnit.toFixed(2),
          data: dateKey(data),
        });
      } catch (error) {
        inc(report, "entradas", "failed");
        pushWarning(report, `Falha ao importar entrada de ${itemCode || item.id}: ${String(error)}`);
      }
    }

    const existingSaidas = await tx.saida.findMany({
      select: {
        itemId: true,
        funcionarioId: true,
        setorSnapshotNome: true,
        qtd: true,
        valorUnit: true,
        data: true,
        responsavelUserId: true,
        obs: true,
      },
    });
    const saidaKeys = new Set(
      existingSaidas.map((row) =>
        saidaIdentityKey({
          itemId: row.itemId,
          funcionarioId: row.funcionarioId,
          setorSnapshotNome: row.setorSnapshotNome,
          qtd: row.qtd,
          valorUnit: Number(row.valorUnit),
          data: row.data,
          responsavelUserId: row.responsavelUserId,
          obs: row.obs,
        })
      )
    );

    const ensureFuncionarioFromSaida = async (raw: LegacyRecord): Promise<{ id: string; nome: string; setorId: string } | null> => {
      const legacyFuncId = normalizeText(raw.funcId);
      if (legacyFuncId) {
        const mappedId = legacyFuncionarioIdMap.get(legacyFuncId);
        if (mappedId) {
          const byId = await tx.funcionario.findUnique({
            where: { id: mappedId },
            select: { id: true, nome: true, setorId: true },
          });
          if (byId) return byId;
        }
      }

      const nome = normalizeText(raw.funcNome) || `Funcionario legado ${legacyFuncId || "sem-id"}`;
      const key = normalizeKey(nome);
      const existing = funcionarioMap.get(key);
      if (existing) return existing;

      const setorNome = normalizeText(raw.setor) || "Sem setor";
      const setor = await ensureSetor(setorNome);
      if (!setor) return null;

      const created = await tx.funcionario.create({
        data: {
          nome,
          cargo: normalizeText(raw.cargo) || "Nao informado",
          setorId: setor.id,
          ativo: true,
        },
        select: { id: true, nome: true, setorId: true },
      });
      funcionarioMap.set(key, created);
      return created;
    };

    const saidaRows = asRecords(payload.saidas as LegacyRecord[]);
    for (const raw of saidaRows) {
      const itemCode = normalizeCode(raw.itemCodigo);
      const legacyItemId = normalizeText(raw.itemId);
      const item =
        (itemCode ? itemByCodigo.get(itemCode) : undefined) ||
        (legacyItemId ? (() => {
          const mapped = legacyItemIdMap.get(legacyItemId);
          return mapped ? { id: mapped, codigo: itemCode || "" } : undefined;
        })() : undefined);

      if (!item) {
        inc(report, "saidas", "skipped");
        pushWarning(
          report,
          `Saida ignorada: itemCodigo/itemId nao encontrado (${itemCode || legacyItemId || "sem referencia"}).`
        );
        continue;
      }

      const funcionario = await ensureFuncionarioFromSaida(raw);
      if (!funcionario) {
        inc(report, "saidas", "failed");
        pushWarning(report, `Saida sem funcionario valido para item ${itemCode || item.id}.`);
        continue;
      }

      const setor = await tx.setor.findUnique({ where: { id: funcionario.setorId }, select: { id: true, nome: true } });
      if (!setor) {
        inc(report, "saidas", "failed");
        pushWarning(report, `Saida sem setor snapshot para funcionario ${funcionario.nome}.`);
        continue;
      }

      const qtd = asInt(raw.qtd, 0);
      if (qtd <= 0) {
        inc(report, "saidas", "failed");
        pushWarning(report, `Saida invalida para item ${itemCode || item.id}: qtd <= 0.`);
        continue;
      }

      const valorUnit = asMoney(raw.valorUnit, 0);
      const data = parseDate(raw.data) || new Date();
      const respKey = normalizeKey(raw.resp || raw.responsavel || "");
      const responsavel = userLookup.get(respKey) || defaultUser || (await ensureFallbackUser());
      const obs = normalizeText(raw.obs) || null;

      const identity = saidaIdentityKey({
        itemId: item.id,
        funcionarioId: funcionario.id,
        setorSnapshotNome: setor.nome,
        qtd,
        valorUnit,
        data,
        responsavelUserId: responsavel.id,
        obs,
      });
      if (saidaKeys.has(identity)) {
        inc(report, "saidas", "skipped");
        continue;
      }

      try {
        const created = await tx.saida.create({
          data: {
            itemId: item.id,
            qtd,
            valorUnit: new Prisma.Decimal(valorUnit),
            data,
            funcionarioId: funcionario.id,
            setorSnapshotId: setor.id,
            setorSnapshotNome: setor.nome,
            responsavelUserId: responsavel.id,
            obs,
          },
          select: { id: true },
        });
        saidaKeys.add(identity);
        inc(report, "saidas", "created");
        await createLegacyAudit(tx, "saidas", created.id, {
          itemId: item.id,
          funcionarioId: funcionario.id,
          setorSnapshotId: setor.id,
          qtd,
          valorUnit: valorUnit.toFixed(2),
          data: dateKey(data),
        });
      } catch (error) {
        inc(report, "saidas", "failed");
        pushWarning(report, `Falha ao importar saida de ${itemCode || item.id}: ${String(error)}`);
      }
    }
  });

  return report;
}

export async function runLegacyImportCli(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
  io: CliIO = console,
  prismaClient?: PrismaClient
): Promise<number> {
  const filePath = args[0];
  if (!filePath) {
    io.error("Uso: node --loader tsx backend/scripts/import-legacy.ts <arquivo.json>");
    return 1;
  }

  const ownClient = !prismaClient;
  const prisma = prismaClient ?? new PrismaClient();
  try {
    const report = await runLegacyImport(filePath, { prismaClient: prisma, env });
    io.log(JSON.stringify(report, null, 2));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.error(message);
    return 1;
  } finally {
    if (ownClient) {
      await prisma.$disconnect();
    }
  }
}

if (typeof require !== "undefined" && require.main === module) {
  runLegacyImportCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
