import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — SDD-004 PR-2.
 * Serves o frontend estático a partir do root do repo via http-server
 * e assume o backend rodando em http://localhost:3000 (npm run dev em backend/).
 * O proxy /api/v1 é feito pelo próprio backend ao receber fetch com
 * credentials:include do front. Para simplificar, o frontend usa
 * window.ALMOX_API_BASE (injetado) apontando para o backend direto.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx http-server .. -p 5173 -a 127.0.0.1 --silent",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
