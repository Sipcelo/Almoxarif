import { test, expect } from "@playwright/test";

const BACKEND_BASE = process.env.ALMOX_BACKEND_URL || "http://localhost:3002/api/v1";

test.beforeEach(async ({ context }) => {
  await context.addInitScript((base) => {
    (window as unknown as { ALMOX_API_BASE: string }).ALMOX_API_BASE = base;
  }, BACKEND_BASE);
});

test("Configuracoes cria setor e lista no painel", async ({ page }) => {
  await page.goto("/index.html");
  await page.fill("#login-email", "admin@rodoviariapel.com");
  await page.fill("#login-senha", "admin2026");
  await page.click("#login-btn");
  await expect(page.locator("#app-shell")).toBeVisible({ timeout: 10_000 });

  await page.click('.sidebar-item[data-page="configuracoes"]');
  await expect(page.locator("#page-configuracoes")).toHaveClass(/active/);
  await expect(page.locator("#cfg-setores")).toContainText(/almoxarifado/i, { timeout: 10_000 });

  const setor = `Setor E2E ${Date.now()}`;
  await page.fill("#cfg-new-setor", setor);
  await page.click('button[onclick="PageConfig.addSetor()"]');

  await expect(page.locator("#cfg-setores")).toContainText(new RegExp(setor, "i"), { timeout: 10_000 });
});
