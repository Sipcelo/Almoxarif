import { test, expect } from "@playwright/test";

const BACKEND_BASE = process.env.ALMOX_BACKEND_URL || "http://localhost:3002/api/v1";

test.beforeEach(async ({ context }) => {
  await context.addInitScript((base) => {
    (window as unknown as { ALMOX_API_BASE: string }).ALMOX_API_BASE = base;
  }, BACKEND_BASE);
});

test("Usuarios cadastra novo usuario pelo backend", async ({ page }) => {
  await page.goto("/index.html");
  await page.fill("#login-email", "admin@rodoviariapel.com");
  await page.fill("#login-senha", "admin2026");
  await page.click("#login-btn");
  await expect(page.locator("#app-shell")).toBeVisible({ timeout: 10_000 });

  await page.click('.sidebar-item[data-page="usuarios"]');
  await expect(page.locator("#page-usuarios")).toHaveClass(/active/);

  await page.click("#page-usuarios .btn.btn-primary");
  await expect(page.locator("#modal-usuario")).toHaveClass(/open/);

  const stamp = Date.now();
  const nome = `Usuario E2E ${stamp}`;
  const email = `usuario.e2e.${stamp}@rodoviariapel.com`;

  await page.fill("#m-usr-nome", nome);
  await page.fill("#m-usr-email", email);
  await page.fill("#m-usr-senha", "senha12345");
  await page.selectOption("#m-usr-role", "operador");
  await page.click("#modal-usuario .btn.btn-primary");

  await expect(page.locator("#usuarios-table")).toContainText(nome, { timeout: 10_000 });
  await expect(page.locator("#usuarios-table")).toContainText(email, { timeout: 10_000 });
});
