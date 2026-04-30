import { test, expect } from "@playwright/test";

/**
 * SDD-004 PR-3 — E2E: Painel (Dashboard).
 *
 * Pré-condições:
 *  - Backend rodando em http://localhost:3002 (gerenciado pelo Playwright).
 *  - Seed aplicado (admin@rodoviariapel.com / admin2026).
 *  - Frontend servido em http://localhost:8080 (webServer do playwright.config.ts).
 */

const BACKEND_BASE = process.env.ALMOX_BACKEND_URL || "http://localhost:3002/api/v1";

test.beforeEach(async ({ context }) => {
  await context.addInitScript((base) => {
    (window as unknown as { ALMOX_API_BASE: string }).ALMOX_API_BASE = base;
  }, BACKEND_BASE);
});

test("Painel carrega cards com valores numéricos vindos do backend", async ({ page }) => {
  await page.goto("/index.html");
  await page.fill("#login-email", "admin@rodoviariapel.com");
  await page.fill("#login-senha", "admin2026");
  await page.click("#login-btn");

  await expect(page.locator("#app-shell")).toBeVisible({ timeout: 10_000 });

  // Painel é a rota default após login.
  const statItens = page.locator('#d-stats [data-stat="itens"]');
  await expect(statItens).toBeVisible({ timeout: 10_000 });
  await expect(statItens).toHaveText(/^\d+$/);

  const statFuncs = page.locator('#d-stats [data-stat="funcionarios"]');
  await expect(statFuncs).toHaveText(/^\d+$/);

  const statBaixo = page.locator('#d-stats [data-stat="baixo"]');
  await expect(statBaixo).toHaveText(/^\d+$/);

  // Nenhum toast de erro persistente.
  const errorToast = page.locator(".notify-error");
  await expect(errorToast).toHaveCount(0);
});

test("Alertas de estoque usam backend e ignoram localStorage legado", async ({ page, context }) => {
  await context.addInitScript(() => {
    localStorage.setItem("alm_items", JSON.stringify([
      {
        id: 999999,
        codigo: "LOCAL-ALERT",
        descricao: "LOCAL ALERT FAKE",
        categoria: "Local",
        deposito: "Local",
        quantidade: 0,
        minimo: 10,
        valor: 1,
        obs: "",
      },
    ]));
  });

  await page.goto("/index.html");
  await page.fill("#login-email", "admin@rodoviariapel.com");
  await page.fill("#login-senha", "admin2026");
  await page.click("#login-btn");

  await expect(page.locator("#app-shell")).toBeVisible({ timeout: 10_000 });

  const stamp = Date.now();
  const alertData = await page.evaluate(async (stampValue) => {
    const api = (window as unknown as { apiClient: any }).apiClient;
    const extractRows = (payload: any, key: string) => Array.isArray(payload) ? payload : payload?.[key] || [];
    const extractTotalPages = (payload: any) => {
      const raw = Number(payload?.meta?.totalPages);
      return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
    };
    const listAll = async (fetchPage: (params: Record<string, unknown>) => Promise<any>, key: string, baseParams = {}) => {
      const limit = 100;
      const first = await fetchPage({ ...baseParams, page: 1, limit });
      const rows = extractRows(first, key);
      const totalPages = extractTotalPages(first);
      if (totalPages <= 1) return rows;
      const chunks = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, idx) =>
          fetchPage({ ...baseParams, page: idx + 2, limit })
        )
      );
      return chunks.reduce((all: any[], payload: any) => all.concat(extractRows(payload, key)), rows);
    };

    const categorias = await listAll(api.categorias.list, "categorias", { ativo: true });
    const depositos = await listAll(api.depositos.list, "depositos", { ativo: true });
    const categoria = categorias[0] || await api.categorias.create({ nome: `Categoria Alerta ${stampValue}` });
    const deposito = depositos[0] || await api.depositos.create({ nome: `Deposito Alerta ${stampValue}` });

    const created = await api.items.create({
      codigo: `ALERT-${stampValue}`,
      descricao: `Alerta API ${stampValue}`,
      categoriaId: categoria.id,
      depositoId: deposito.id,
      quantidade: 0,
      minimo: 5,
      valorAtual: 1,
    });
    const item = created.item || created;

    const alerts = await listAll(api.items.list, "items", { ativo: true, baixoEstoque: true });
    const count = alerts.filter((row: any) => Number(row.quantidade || 0) < Number(row.minimo || 0)).length;
    return { descricao: item.descricao, count };
  }, stamp);

  await page.locator('.sidebar-item[data-page="estoque"]').click();
  await expect(page.locator("#page-estoque")).toHaveClass(/active/);

  await expect(page.locator("#notif-count")).toHaveText(String(alertData.count), { timeout: 10_000 });
  await page.locator(".topbar-notif").click();
  await expect(page.locator("#alert-list")).toContainText(alertData.descricao, { timeout: 10_000 });
  await expect(page.locator("#alert-list")).not.toContainText("LOCAL ALERT FAKE");
});
