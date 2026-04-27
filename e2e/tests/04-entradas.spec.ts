import { test, expect } from "@playwright/test";

const BACKEND_BASE = process.env.ALMOX_BACKEND_URL || "http://localhost:3002/api/v1";

test.beforeEach(async ({ context }) => {
  await context.addInitScript((base) => {
    (window as unknown as { ALMOX_API_BASE: string }).ALMOX_API_BASE = base;
  }, BACKEND_BASE);
});

test("Entradas registra movimentacao e incrementa saldo do item", async ({ page }) => {
  await page.goto("/index.html");
  await page.fill("#login-email", "admin@rodoviariapel.com");
  await page.fill("#login-senha", "admin2026");
  await page.click("#login-btn");
  await expect(page.locator("#app-shell")).toBeVisible({ timeout: 10_000 });

  await page.click('.sidebar-item[data-page="estoque"]');
  await expect(page.locator("#page-estoque")).toHaveClass(/active/);

  const code = `E2E-ENT-${Date.now()}`;
  const description = `Item E2E Entrada ${Date.now()}`;

  await page.getByRole("button", { name: /Novo Item/i }).click();
  await expect(page.locator("#modal-item")).toHaveClass(/open/);
  await page.fill("#m-item-codigo", code);
  await page.fill("#m-item-desc", description);

  const categoriaSelect = page.locator("#m-item-cat");
  const depositoSelect = page.locator("#m-item-dep");
  const categoriaOption = categoriaSelect.locator("option:not([value=''])");
  const depositoOption = depositoSelect.locator("option:not([value=''])");
  await expect.poll(async () => categoriaOption.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect.poll(async () => depositoOption.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  const categoriaValue = await categoriaOption.first().getAttribute("value");
  const depositoValue = await depositoOption.first().getAttribute("value");
  await categoriaSelect.selectOption(categoriaValue || "");
  await depositoSelect.selectOption(depositoValue || "");

  await page.fill("#m-item-qtd", "5");
  await page.fill("#m-item-min", "1");
  await page.fill("#m-item-valor", "10");
  await page.click("#modal-item .btn.btn-primary");

  await expect(page.locator("#est-table")).toContainText(code, { timeout: 10_000 });

  await page.click('.sidebar-item[data-page="entradas"]');
  await expect(page.locator("#page-entradas")).toHaveClass(/active/);

  await page.getByRole("button", { name: /Registrar Entrada/i }).first().click();
  await expect(page.locator("#modal-entrada")).toHaveClass(/open/);
  const option = page.locator("#m-ent-item option").filter({ hasText: description }).first();
  await expect.poll(async () => option.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  const optionValue = await option.getAttribute("value");
  await page.selectOption("#m-ent-item", optionValue || "");
  await page.fill("#m-ent-qtd", "3");
  await page.fill("#m-ent-obs", "entrada e2e");
  await page.click("#modal-entrada .btn.btn-primary");

  await expect(page.locator("#ent-table")).toContainText(code, { timeout: 10_000 });
  await expect(page.locator("#ent-table")).toContainText("+3");

  await page.click('.sidebar-item[data-page="estoque"]');
  await expect(page.locator("#page-estoque")).toHaveClass(/active/);
  await page.fill("#est-search", code);
  const row = page.locator("#est-table tbody tr").filter({ hasText: code }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row.locator("td").nth(4)).toContainText("8");
});
