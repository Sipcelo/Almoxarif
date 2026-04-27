import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — SDD-004 PR-2.
 * Serves o frontend estático a partir do root do repo via http-server
 * e assume o backend rodando em http://localhost:3001 (npm run dev em backend/).
 * O proxy /api/v1 é feito pelo próprio backend ao receber fetch com
 * credentials:include do front. Para simplificar, o frontend usa
 * window.ALMOX_API_BASE (injetado) apontando para o backend direto.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8080",
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
  webServer: [
    {
      command:
        "powershell -Command \"$env:PORT='3002'; $env:HOST='127.0.0.1'; $env:DATABASE_URL='postgresql://postgres:123456@localhost:5432/almox_test'; $env:SESSION_SECRET='sdd004-e2e-session-secret-1234567890'; $env:CORS_ORIGIN='http://localhost:8080'; $env:SEED_ENABLED='true'; $env:RATE_LIMIT_MAX='10000'; $env:RATE_LIMIT_WINDOW_MS='60000'; $env:LOGIN_RATE_LIMIT_MAX='1000'; $env:LOGIN_RATE_LIMIT_WINDOW_MS='60000'; npm --prefix ../backend run prisma:seed; npm --prefix ../backend run dev\"",
      url: "http://localhost:3002/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npx http-server .. -p 8080 -a localhost --silent",
      url: "http://localhost:8080",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
