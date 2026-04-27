import { test, expect } from "@playwright/test";

const BACKEND_BASE = process.env.ALMOX_BACKEND_URL || "http://localhost:3002/api/v1";

test.beforeEach(async ({ context }) => {
  await context.addInitScript((base) => {
    (window as unknown as { ALMOX_API_BASE: string }).ALMOX_API_BASE = base;
  }, BACKEND_BASE);
});

test("Relatorios renderiza dados vindos do backend", async ({ page }) => {
  test.setTimeout(120_000);

  const stamp = Date.now();
  const categoria = `Cat E2E ${stamp}`;
  const deposito = `Dep E2E ${stamp}`;
  const setor = `Setor E2E ${stamp}`;
  const codigo = `E2E${String(stamp).slice(-6)}`;
  const itemNome = `Item Relatorio ${stamp}`;
  const funcionarioNome = `Funcionario Relatorio ${stamp}`;

  await page.goto("/index.html");
  await page.fill("#login-email", "admin@rodoviariapel.com");
  await page.fill("#login-senha", "admin2026");
  await page.click("#login-btn");
  await expect(page.locator("#app-shell")).toBeVisible({ timeout: 10_000 });

  await page.click('.sidebar-item[data-page="configuracoes"]');
  await expect(page.locator("#page-configuracoes")).toHaveClass(/active/);

  await page.fill("#cfg-new-cat", categoria);
  await page.click('button[onclick="PageConfig.addCat()"]');
  await expect(page.locator("#cfg-cats")).toContainText(new RegExp(categoria, "i"), { timeout: 10_000 });

  await page.fill("#cfg-new-dep", deposito);
  await page.click('button[onclick="PageConfig.addDep()"]');
  await expect(page.locator("#cfg-deps")).toContainText(new RegExp(deposito, "i"), { timeout: 10_000 });

  await page.fill("#cfg-new-setor", setor);
  await page.click('button[onclick="PageConfig.addSetor()"]');
  await expect(page.locator("#cfg-setores")).toContainText(new RegExp(setor, "i"), { timeout: 10_000 });

  await page.click('.sidebar-item[data-page="estoque"]');
  await expect(page.locator("#page-estoque")).toHaveClass(/active/);
  await page.click("#page-estoque .btn.btn-primary");
  await expect(page.locator("#modal-item")).toHaveClass(/open/);

  await page.fill("#m-item-codigo", codigo);
  await page.fill("#m-item-desc", itemNome);
  const catOption = page.locator("#m-item-cat option").filter({ hasText: new RegExp(categoria, "i") }).first();
  await expect.poll(async () => catOption.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  const catValue = await catOption.getAttribute("value");
  await page.selectOption("#m-item-cat", catValue || "");
  const depOption = page.locator("#m-item-dep option").filter({ hasText: new RegExp(deposito, "i") }).first();
  await expect.poll(async () => depOption.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  const depValue = await depOption.getAttribute("value");
  await page.selectOption("#m-item-dep", depValue || "");
  await page.fill("#m-item-qtd", "10");
  await page.fill("#m-item-min", "2");
  await page.fill("#m-item-valor", "12.50");
  await page.click("#modal-item .btn.btn-primary");
  await expect(page.locator("#est-table")).toContainText(codigo, { timeout: 10_000 });

  await page.click('.sidebar-item[data-page="funcionarios"]');
  await expect(page.locator("#page-funcionarios")).toHaveClass(/active/);
  await page.click("#page-funcionarios .btn.btn-primary");
  await expect(page.locator("#modal-funcionario")).toHaveClass(/open/);
  await page.fill("#m-func-nome", funcionarioNome);
  await page.fill("#m-func-cargo", "Analista");
  const setorOption = page.locator("#m-func-setor option").filter({ hasText: new RegExp(setor, "i") }).first();
  await expect.poll(async () => setorOption.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  const setorValue = await setorOption.getAttribute("value");
  await page.selectOption("#m-func-setor", setorValue || "");
  await page.click("#modal-funcionario .btn.btn-primary");
  await expect(page.locator("#func-table")).toContainText(funcionarioNome, { timeout: 10_000 });

  await page.click('.sidebar-item[data-page="entradas"]');
  await expect(page.locator("#page-entradas")).toHaveClass(/active/);
  await page.click("#page-entradas .btn.btn-primary");
  await expect(page.locator("#modal-entrada")).toHaveClass(/open/);
  const entradaItemOption = page.locator("#m-ent-item option").filter({ hasText: itemNome }).first();
  await expect.poll(async () => entradaItemOption.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  const entradaItemValue = await entradaItemOption.getAttribute("value");
  await page.selectOption("#m-ent-item", entradaItemValue || "");
  await page.fill("#m-ent-qtd", "3");
  await page.click("#modal-entrada .btn.btn-primary");

  await page.click('.sidebar-item[data-page="saidas"]');
  await expect(page.locator("#page-saidas")).toHaveClass(/active/);
  await page.click("#page-saidas .btn.btn-primary");
  await expect(page.locator("#modal-saida")).toHaveClass(/open/);
  const saidaItemOption = page.locator("#m-sai-item option").filter({ hasText: itemNome }).first();
  await expect.poll(async () => saidaItemOption.count(), { timeout: 10_000 }).toBeGreaterThan(0);
  const saidaItemValue = await saidaItemOption.getAttribute("value");
  await page.selectOption("#m-sai-item", saidaItemValue || "");
  await page.fill("#m-sai-func-search", funcionarioNome);
  await page.locator("#m-sai-func-results div").first().click();
  await page.fill("#m-sai-qtd", "2");
  await page.click("#modal-saida .btn.btn-primary");

  await page.click('.sidebar-item[data-page="relatorios"]');
  await expect(page.locator("#page-relatorios")).toHaveClass(/active/);
  await expect(page.locator("#rel-metricas")).toContainText(/Valor em Estoque/i, { timeout: 10_000 });
  await expect(page.locator("#rel-hist")).toContainText(itemNome, { timeout: 10_000 });
  await expect(page.locator("#rel-setores")).toContainText(new RegExp(setor, "i"), { timeout: 10_000 });
});
