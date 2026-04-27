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
