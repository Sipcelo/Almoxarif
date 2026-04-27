import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BACKEND_BASE = process.env.ALMOX_BACKEND_URL || "http://localhost:3002/api/v1";
const BACKEND_ORIGIN = new URL(BACKEND_BASE).origin;

test.beforeEach(async ({ context }) => {
  await context.addInitScript((base) => {
    (window as unknown as { ALMOX_API_BASE: string }).ALMOX_API_BASE = base;
  }, BACKEND_BASE);
});

async function parseJson(response: Awaited<ReturnType<APIRequestContext["fetch"]>>) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function csrfToken(context: BrowserContext) {
  const cookies = await context.cookies(BACKEND_ORIGIN);
  const token = cookies.find((c) => c.name === "almox_csrf")?.value;
  expect(token, "Cookie almox_csrf ausente apos login").toBeTruthy();
  return token as string;
}

async function apiGet(
  request: APIRequestContext,
  path: string
): Promise<Record<string, unknown>> {
  const response = await request.fetch(`${BACKEND_BASE}${path}`, { method: "GET" });
  const body = (await parseJson(response)) as Record<string, unknown>;
  expect(response.ok(), `GET ${path} falhou: ${response.status()}`).toBeTruthy();
  return body;
}

async function apiPost(
  request: APIRequestContext,
  context: BrowserContext,
  path: string,
  payload: unknown
): Promise<Record<string, unknown>> {
  const response = await request.fetch(`${BACKEND_BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-almox-csrf": await csrfToken(context),
    },
    data: payload,
  });
  const body = (await parseJson(response)) as Record<string, unknown>;
  expect(response.ok(), `POST ${path} falhou: ${response.status()}`).toBeTruthy();
  return body;
}

type NamedEntity = { id: string; nome: string };

function firstOf<T>(value: unknown): T | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value[0] as T;
}

async function ensureSetor(
  request: APIRequestContext,
  context: BrowserContext,
  suffix: number
): Promise<NamedEntity> {
  const listed = await apiGet(request, "/settings/setores?ativo=true&limit=1");
  const existing = firstOf<NamedEntity>(listed.setores);
  if (existing?.id) return existing;
  const created = await apiPost(request, context, "/settings/setores", { nome: `setor-e2e-${suffix}` });
  return created.setor as NamedEntity;
}

async function ensureCategoria(
  request: APIRequestContext,
  context: BrowserContext,
  suffix: number
): Promise<NamedEntity> {
  const listed = await apiGet(request, "/settings/categorias?ativo=true&limit=1");
  const existing = firstOf<NamedEntity>(listed.categorias);
  if (existing?.id) return existing;
  const created = await apiPost(request, context, "/settings/categorias", { nome: `categoria-e2e-${suffix}` });
  return created.categoria as NamedEntity;
}

async function ensureDeposito(
  request: APIRequestContext,
  context: BrowserContext,
  suffix: number
): Promise<NamedEntity> {
  const listed = await apiGet(request, "/settings/depositos?ativo=true&limit=1");
  const existing = firstOf<NamedEntity>(listed.depositos);
  if (existing?.id) return existing;
  const created = await apiPost(request, context, "/settings/depositos", { nome: `deposito-e2e-${suffix}` });
  return created.deposito as NamedEntity;
}

test("Saidas registra movimentacao e decrementa saldo no estoque", async ({ page, context }) => {
  await page.goto("/index.html");
  await page.fill("#login-email", "admin@rodoviariapel.com");
  await page.fill("#login-senha", "admin2026");
  await page.click("#login-btn");
  await expect(page.locator("#app-shell")).toBeVisible({ timeout: 10_000 });

  const api = context.request;
  const suffix = Date.now();

  const setor = await ensureSetor(api, context, suffix);
  const categoria = await ensureCategoria(api, context, suffix);
  const deposito = await ensureDeposito(api, context, suffix);

  const funcionarioNome = `Func E2E ${suffix}`;
  const funcionarioPayload = {
    nome: funcionarioNome,
    cargo: "Almoxarife",
    setorId: setor.id,
  };
  const funcionarioResp = await apiPost(api, context, "/funcionarios", funcionarioPayload);
  const funcionario = funcionarioResp.funcionario as { id: string; nome: string };

  const codigo = `E2E-SAI-${suffix}`;
  const descricao = `Item E2E Saida ${suffix}`;
  const itemPayload = {
    codigo,
    descricao,
    categoriaId: categoria.id,
    depositoId: deposito.id,
    quantidade: 7,
    minimo: 1,
    valorAtual: 10,
  };
  const itemResp = await apiPost(api, context, "/items", itemPayload);
  const item = itemResp.item as { id: string };

  await page.click('.sidebar-item[data-page="saidas"]');
  await expect(page.locator("#page-saidas")).toHaveClass(/active/);

  await page.click("#page-saidas .btn.btn-primary");
  await expect(page.locator("#modal-saida")).toHaveClass(/open/);

  await page.selectOption("#m-sai-item", item.id);
  await page.fill("#m-sai-qtd", "2");
  await page.fill("#m-sai-obs", "saida e2e");

  await page.fill("#m-sai-func-search", funcionario.nome);
  const funcResult = page
    .locator("#m-sai-func-results div")
    .filter({ hasText: funcionario.nome })
    .first();
  await expect(funcResult).toBeVisible({ timeout: 10_000 });
  await funcResult.click();
  await expect(page.locator("#m-sai-func-id")).toHaveValue(funcionario.id);

  await page.click("#modal-saida .btn.btn-primary");

  await expect(page.locator("#sai-table")).toContainText(codigo, { timeout: 10_000 });
  await expect(page.locator("#sai-table")).toContainText(funcionario.nome);
  await expect(page.locator("#sai-table")).toContainText("-2");

  await page.click('.sidebar-item[data-page="estoque"]');
  await expect(page.locator("#page-estoque")).toHaveClass(/active/);
  await page.fill("#est-search", codigo);
  const row = page.locator("#est-table tbody tr").filter({ hasText: codigo }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row.locator("td").nth(4)).toContainText("5");
});
