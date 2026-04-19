// Carrega apiClient.js no contexto jsdom antes de cada arquivo de teste.
// Como apiClient.js usa IIFE e seta window.apiClient, basta executar o script.
import fs from "node:fs";
import path from "node:path";
import { beforeEach, vi } from "vitest";

const SRC = fs.readFileSync(
  path.resolve(__dirname, "..", "apiClient.js"),
  "utf8"
);

// Executa o IIFE no contexto do jsdom (window === globalThis neste ambiente)
// Um eval no escopo global basta; apiClient.js é auto-contido.
// eslint-disable-next-line no-eval
(0, eval)(SRC);

beforeEach(() => {
  // limpa cookies e mocks
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
  vi.restoreAllMocks();
  // stub fetch por default (cada teste sobrescreve)
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
});
