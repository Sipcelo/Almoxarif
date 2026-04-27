import { test, expect } from "@playwright/test";

const BACKEND_BASE = process.env.ALMOX_BACKEND_URL || "http://localhost:3002/api/v1";

test.beforeEach(async ({ context }) => {
  await context.addInitScript((base) => {
    (window as unknown as { ALMOX_API_BASE: string }).ALMOX_API_BASE = base;
  }, BACKEND_BASE);
});

test("Estoque cria item via backend e lista na tabela", async ({ page }) => {
  await page.goto("/index.html");
  await page.fill("#login-email", "admin@rodoviariapel.com");
  await page.fill("#login-senha", "admin2026");
  await page.click("#login-btn");

  await expect(page.locator("#app-shell")).toBeVisible({ timeout: 10_000 });

  await page.click('.sidebar-item[data-page="estoque"]');
  await expect(page.locator("#page-estoque")).toHaveClass(/active/);

  const codigo = `E2E-${Date.now()}`;
  await page.getByRole("button", { name: /Novo Item/i }).click();
  await expect(page.locator("#modal-item")).toHaveClass(/open/);
  await page.fill("#m-item-codigo", codigo);
  await page.fill("#m-item-desc", "Item E2E Estoque");

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

  await page.fill("#m-item-qtd", "7");
  await page.fill("#m-item-min", "2");
  await page.fill("#m-item-valor", "12.5");
  await page.click("#modal-item .btn.btn-primary");

  await expect(page.locator("#est-table")).toContainText(codigo, { timeout: 10_000 });
});
