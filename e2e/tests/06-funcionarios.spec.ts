import { test, expect } from "@playwright/test";

const BACKEND_BASE = process.env.ALMOX_BACKEND_URL || "http://localhost:3002/api/v1";

test.beforeEach(async ({ context }) => {
  await context.addInitScript((base) => {
    (window as unknown as { ALMOX_API_BASE: string }).ALMOX_API_BASE = base;
  }, BACKEND_BASE);
});

test("Funcionarios cadastra novo funcionario em setor ativo", async ({ page }) => {
  await page.goto("/index.html");
  await page.fill("#login-email", "admin@rodoviariapel.com");
  await page.fill("#login-senha", "admin2026");
  await page.click("#login-btn");
  await expect(page.locator("#app-shell")).toBeVisible({ timeout: 10_000 });

  await page.click('.sidebar-item[data-page="funcionarios"]');
  await expect(page.locator("#page-funcionarios")).toHaveClass(/active/);

  await page.click("#page-funcionarios .btn.btn-primary");
  await expect(page.locator("#modal-funcionario")).toHaveClass(/open/);

  const setorOption = page.locator("#m-func-setor option:not([value=''])").first();
  await expect.poll(async () => setorOption.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  const setorId = await setorOption.getAttribute("value");
  await page.selectOption("#m-func-setor", setorId || "");

  const nome = `Func E2E ${Date.now()}`;
  await page.fill("#m-func-nome", nome);
  await page.fill("#m-func-cargo", "Almoxarife");
  await page.click("#modal-funcionario .btn.btn-primary");

  await page.fill("#func-search", nome);
  const row = page.locator("#func-table tbody tr").filter({ hasText: nome }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText("Almoxarife");
});
