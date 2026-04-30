import { test, expect } from "@playwright/test";

const BACKEND_BASE = process.env.ALMOX_BACKEND_URL || "http://localhost:3002/api/v1";

test.beforeEach(async ({ context }) => {
  await context.addInitScript((base) => {
    (window as unknown as { ALMOX_API_BASE: string }).ALMOX_API_BASE = base;
    localStorage.setItem("alm_acessos", JSON.stringify([
      {
        id: 999999,
        nome: "LOCAL ACESSO FAKE",
        tipo: "Entrada",
        hora: "07:00",
        data: "2026-04-30",
        cargo: "Local",
      },
    ]));
  }, BACKEND_BASE);
});

test("Controle de Acesso registra e lista dados pelo backend", async ({ page }) => {
  await page.goto("/index.html");
  await page.fill("#login-email", "admin@rodoviariapel.com");
  await page.fill("#login-senha", "admin2026");
  await page.click("#login-btn");

  await expect(page.locator("#app-shell")).toBeVisible({ timeout: 10_000 });

  await page.click('.sidebar-item[data-page="acesso"]');
  await expect(page.locator("#page-acesso")).toHaveClass(/active/);
  await expect(page.locator("#ac-table")).not.toContainText("LOCAL ACESSO FAKE");

  const nome = `Visitante API ${Date.now()}`;
  await page.getByRole("button", { name: /Registrar Acesso/i }).click();
  await expect(page.locator("#modal-acesso")).toHaveClass(/open/);

  await page.fill("#m-ac-nome", nome);
  await page.selectOption("#m-ac-tipo", "Saida");
  await page.fill("#m-ac-cargo", "Motorista");
  await page.fill("#m-ac-hora", "14:35");
  await page.fill("#m-ac-data", "2026-04-30");
  await page.click("#modal-acesso .btn.btn-primary");

  await expect(page.locator("#modal-acesso")).not.toHaveClass(/open/, { timeout: 10_000 });
  await expect(page.locator("#ac-table")).toContainText(nome, { timeout: 10_000 });
  await expect(page.locator("#ac-table")).toContainText("Saída");

  const apiResult = await page.evaluate(async (nomeBusca) => {
    const api = (window as unknown as { apiClient: any }).apiClient;
    const response = await api.acessos.list({ q: nomeBusca });
    return response.acessos?.[0] || null;
  }, nome);

  expect(apiResult).toMatchObject({
    nome,
    tipo: "Saida",
    hora: "14:35",
    data: "2026-04-30",
    cargo: "Motorista",
  });
});
