import { test, expect } from "@playwright/test";

const BACKEND_BASE = process.env.ALMOX_BACKEND_URL || "http://localhost:3002/api/v1";

test.beforeEach(async ({ context }) => {
  await context.addInitScript((base) => {
    (window as unknown as { ALMOX_API_BASE: string }).ALMOX_API_BASE = base;
  }, BACKEND_BASE);
});

function parseMoney(text: string) {
  const raw = text.replace(/R\$\s?/, "").trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Number(normalized);
}

test("Usabilidade entrada em massa: 9 funcionarios, 100 itens e soma renderizada na UI", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/index.html");
  await page.fill("#login-email", "admin@rodoviariapel.com");
  await page.fill("#login-senha", "admin2026");
  await page.click("#login-btn");
  await expect(page.locator("#app-shell")).toBeVisible({ timeout: 10_000 });

  const stamp = Date.now();
  const prefix = `UI-MASS-${stamp}`;

  const base = await page.evaluate(async ({ prefix }) => {
    const api = (window as any).apiClient;
    const [categoriaResp, depositoResp, setorResp] = await Promise.all([
      api.categorias.create({ nome: `${prefix} Categoria` }),
      api.depositos.create({ nome: `${prefix} Deposito` }),
      api.setores.create({ nome: `${prefix} Setor` }),
    ]);

    return {
      categoriaId: categoriaResp.categoria.id,
      depositoId: depositoResp.deposito.id,
      setorId: setorResp.setor.id,
    };
  }, { prefix });

  await page.click('.sidebar-item[data-page="funcionarios"]');
  await expect(page.locator("#page-funcionarios")).toHaveClass(/active/);

  for (let i = 1; i <= 9; i += 1) {
    const suffix = String(i).padStart(2, "0");
    await page.click("#page-funcionarios .btn.btn-primary");
    await expect(page.locator("#modal-funcionario")).toHaveClass(/open/);
    await expect.poll(
      async () => page.locator(`#m-func-setor option[value="${base.setorId}"]`).count(),
      { timeout: 10_000 }
    ).toBe(1);
    await page.selectOption("#m-func-setor", base.setorId);
    await page.fill("#m-func-nome", `${prefix} Funcionario ${suffix}`);
    await page.fill("#m-func-cargo", "Conferente");
    await page.click("#modal-funcionario .btn.btn-primary");
    await expect(page.locator("#modal-funcionario")).not.toHaveClass(/open/, { timeout: 10_000 });
  }

  await page.fill("#func-search", prefix);
  await expect.poll(
    async () => page.locator("#func-table tbody tr").count(),
    { timeout: 15_000 }
  ).toBe(9);

  const mass = await page.evaluate(async ({ prefix, categoriaId, depositoId }) => {
    const api = (window as any).apiClient;

    async function inBatches<T, R>(
      rows: T[],
      size: number,
      mapper: (row: T, index: number) => Promise<R>
    ): Promise<R[]> {
      const out: R[] = [];
      for (let i = 0; i < rows.length; i += size) {
        const chunk = rows.slice(i, i + size);
        out.push(...await Promise.all(chunk.map((row, idx) => mapper(row, i + idx))));
      }
      return out;
    }

    const lines = Array.from({ length: 100 }, (_, idx) => {
      const line = idx + 1;
      const suffix = String(line).padStart(3, "0");
      return {
        codigo: `${prefix}-${suffix}`,
        descricao: `${prefix} Item ${suffix}`,
        qtd: (idx % 5) + 1,
        valorUnit: Number((7.5 + (idx % 13) * 0.75).toFixed(2)),
      };
    });

    const items = await inBatches(lines, 10, async (line) => {
      const created = await api.items.create({
        codigo: line.codigo,
        descricao: line.descricao,
        categoriaId,
        depositoId,
        quantidade: 0,
        minimo: 1,
        valorAtual: 0,
        obs: "Carga de usabilidade para entrada em massa",
      });
      return { ...line, itemId: created.item.id };
    });

    await inBatches(items, 10, async (line) => {
      await api.entradas.create({
        itemId: line.itemId,
        qtd: line.qtd,
        valorUnit: line.valorUnit,
        obs: `${prefix} carga nota simulada`,
      });
      return true;
    });

    return {
      expectedRows: lines.length,
      expectedQty: lines.reduce((sum, line) => sum + line.qtd, 0),
      expectedValue: Number(lines.reduce((sum, line) => sum + line.qtd * line.valorUnit, 0).toFixed(2)),
    };
  }, { prefix, categoriaId: base.categoriaId, depositoId: base.depositoId });

  await page.click('.sidebar-item[data-page="entradas"]');
  await expect(page.locator("#page-entradas")).toHaveClass(/active/);
  await page.fill("#ent-search", prefix);
  await expect.poll(
    async () => page.locator("#ent-table tbody tr").count(),
    { timeout: 20_000 }
  ).toBe(mass.expectedRows);

  const entradaRows = await page.locator("#ent-table tbody tr").evaluateAll((rows) =>
    rows.map((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      const qtdText = cells[2]?.textContent || "";
      return {
        qtd: Number((qtdText.match(/\d+/) || ["0"])[0]),
        valorTotal: cells[3]?.textContent || "",
      };
    })
  );
  const uiQty = entradaRows.reduce((sum, row) => sum + row.qtd, 0);
  const uiValue = entradaRows.reduce((sum, row) => sum + parseMoney(row.valorTotal), 0);
  expect(uiQty).toBe(mass.expectedQty);
  expect(uiValue).toBeCloseTo(mass.expectedValue, 2);

  await page.click('.sidebar-item[data-page="estoque"]');
  await expect(page.locator("#page-estoque")).toHaveClass(/active/);
  await page.fill("#est-search", prefix);
  await expect.poll(
    async () => page.locator("#est-table tbody tr").count(),
    { timeout: 20_000 }
  ).toBe(mass.expectedRows);

  const estoqueRows = await page.locator("#est-table tbody tr").evaluateAll((rows) =>
    rows.map((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      const qtdText = cells[4]?.textContent || "";
      return Number((qtdText.match(/\d+/) || ["0"])[0]);
    })
  );
  expect(estoqueRows.reduce((sum, qtd) => sum + qtd, 0)).toBe(mass.expectedQty);

  await page.click('.sidebar-item[data-page="entradas"]');
  await page.getByRole("button", { name: /Registrar Entrada/i }).first().click();
  await expect(page.locator("#modal-entrada")).toHaveClass(/open/);
  await expect(page.locator("#m-ent-item")).toBeVisible();
  await expect(page.locator("#modal-entrada input[type='file']")).toHaveCount(0);
  await expect(page.locator("#modal-entrada")).not.toContainText(/nota|lote|massa|csv/i);
});
