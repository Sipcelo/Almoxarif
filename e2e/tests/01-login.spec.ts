import { test, expect } from "@playwright/test";

/**
 * SDD-004 PR-2 — Primeiro fluxo E2E: login.
 *
 * Pré-condições:
 *  - Backend rodando em http://localhost:3002 (gerenciado pelo Playwright).
 *  - Seed aplicado (admin@rodoviariapel.com / admin2026).
 *  - Frontend servido em http://localhost:8080 (webServer do playwright.config.ts).
 *  - window.ALMOX_API_BASE deve apontar para o backend — injetado via addInitScript.
 */

const BACKEND_BASE = process.env.ALMOX_BACKEND_URL || "http://localhost:3002/api/v1";

test.beforeEach(async ({ context }) => {
  await context.addInitScript((base) => {
    (window as unknown as { ALMOX_API_BASE: string }).ALMOX_API_BASE = base;
  }, BACKEND_BASE);
});

test("login com credenciais válidas leva à tela principal", async ({ page }) => {
  await page.goto("/index.html");

  await expect(page.locator("#login-shell")).toBeVisible();
  await page.fill("#login-email", "admin@rodoviariapel.com");
  await page.fill("#login-senha", "admin2026");
  await page.click("#login-btn");

  await expect(page.locator("#app-shell")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#login-shell")).toBeHidden();
});

test("login com senha inválida mostra erro amigável", async ({ page }) => {
  await page.goto("/index.html");
  await page.fill("#login-email", "admin@rodoviariapel.com");
  await page.fill("#login-senha", "senha-errada");
  await page.click("#login-btn");

  await expect(page.locator("#login-error")).toHaveClass(/show/, { timeout: 5_000 });
  await expect(page.locator("#login-error-msg")).toContainText(/(incorret|inválid|invalid)/i);
  await expect(page.locator("#app-shell")).toBeHidden();
});
