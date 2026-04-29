import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app/server";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("SDD-006 frontend estatico", () => {
  it("serve o shell do MVP na raiz do dominio", async () => {
    const res = await app.inject({ method: "GET", url: "/" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("apiClient.js");
    expect(res.body).toContain("app-shell");
  });

  it("serve apiClient no mesmo dominio", async () => {
    const res = await app.inject({ method: "GET", url: "/apiClient.js" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/javascript");
    expect(res.body).toContain("/api/v1");
  });

  it("serve assets de CSS do frontend", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/front/css/variables.css",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/css");
    expect(res.body).toContain("--brand");
  });

  it("nao serve arquivo fora do diretorio publico", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/front/%252e%252e/%252e%252e/package.json",
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });

  it("aplica CSP compativel com o frontend legado", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    const csp = String(res.headers["content-security-policy"]);

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("https://fonts.googleapis.com");
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
    expect(csp).toContain("connect-src 'self'");
  });

  it("preserva CSP restritiva para API JSON", async () => {
    const res = await app.inject({ method: "GET", url: "/health/live" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-security-policy"]).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    );
  });
});
