/* ============================================================
   ALMOX — apiClient (SDD-004 PR-2)
   Fetch client with cookie credentials + CSRF double-submit.
   Exposed as window.apiClient (IIFE, no build step required).
   ============================================================ */
(function (global) {
  "use strict";

  const API_BASE =
    (global.ALMOX_API_BASE && String(global.ALMOX_API_BASE)) || "/api/v1";
  const TIMEOUT_MS = 10000;
  const CSRF_HEADER = "x-almox-csrf";
  const CSRF_COOKIE = "almox_csrf";
  const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  const CSRF_EXEMPT_PATHS = new Set(["/auth/login"]);

  class ApiError extends Error {
    constructor(opts) {
      super(opts.message);
      this.name = "ApiError";
      this.code = opts.code;
      this.status = opts.status;
      this.details = opts.details || [];
    }
  }

  function csrfFromCookie() {
    const cookie = global.document ? global.document.cookie : "";
    const match = cookie.match(/(?:^|;\s*)almox_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function qs(params) {
    if (!params) return "";
    const entries = Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== ""
    );
    if (entries.length === 0) return "";
    const pairs = entries.map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
    );
    return `?${pairs.join("&")}`;
  }

  function requiresCsrf(method, path) {
    if (!MUTATING.has(method)) return false;
    return !CSRF_EXEMPT_PATHS.has(path);
  }

  async function http(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const headers = { "Content-Type": "application/json" };
    if (requiresCsrf(method, path)) {
      const token = csrfFromCookie();
      if (!token) {
        clearTimeout(timer);
        throw new ApiError({
          code: "CSRF_MISSING",
          message: "Sessão inconsistente. Faça login novamente.",
          status: 0,
        });
      }
      headers[CSRF_HEADER] = token;
    }

    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        credentials: "include",
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      const isAbort = e && (e.name === "AbortError" || e.code === 20);
      throw new ApiError({
        code: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
        message: isAbort
          ? "Tempo de resposta esgotado. Tente novamente."
          : "Falha de conexão. Tente novamente.",
        status: 0,
      });
    }
    clearTimeout(timer);

    if (res.status === 204) return null;

    let payload = null;
    const ct = (res.headers && res.headers.get("content-type")) || "";
    if (ct.includes("application/json")) {
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
    }

    if (res.ok) return payload;

    if (res.status === 401) {
      if (global.dispatchEvent) {
        global.dispatchEvent(new CustomEvent("almox:session-expired"));
      }
    }

    const err = (payload && payload.error) || {};
    throw new ApiError({
      code: err.code || "UNKNOWN",
      message: err.message || "Erro inesperado",
      status: res.status,
      details: err.details,
    });
  }

  function crudFactory(basePath) {
    return {
      list: (params) => http("GET", `${basePath}${qs(params)}`),
      get: (id) => http("GET", `${basePath}/${encodeURIComponent(id)}`),
      create: (payload) => http("POST", basePath, payload),
      update: (id, payload) =>
        http("PUT", `${basePath}/${encodeURIComponent(id)}`, payload),
      remove: (id) => http("DELETE", `${basePath}/${encodeURIComponent(id)}`),
    };
  }

  const apiClient = {
    ApiError,
    _http: http,
    _csrfFromCookie: csrfFromCookie,
    _qs: qs,
    auth: {
      login: (email, senha) => http("POST", "/auth/login", { email, senha }),
      logout: () => http("POST", "/auth/logout"),
      me: () => http("GET", "/auth/me"),
    },
    users: {
      list: (params) => http("GET", `/users${qs(params)}`),
      get: (id) => http("GET", `/users/${encodeURIComponent(id)}`),
      create: (payload) => http("POST", "/users", payload),
      update: (id, payload) =>
        http("PUT", `/users/${encodeURIComponent(id)}`, payload),
      updatePassword: (id, senha) =>
        http("PATCH", `/users/${encodeURIComponent(id)}/password`, {
          novaSenha: senha,
        }),
      remove: (id) => http("DELETE", `/users/${encodeURIComponent(id)}`),
    },
    funcionarios: crudFactory("/funcionarios"),
    setores: crudFactory("/settings/setores"),
    categorias: crudFactory("/settings/categorias"),
    depositos: crudFactory("/settings/depositos"),
    items: crudFactory("/items"),
    entradas: {
      list: (params) => http("GET", `/entradas${qs(params)}`),
      create: (payload) => http("POST", "/entradas", payload),
    },
    saidas: {
      list: (params) => http("GET", `/saidas${qs(params)}`),
      create: (payload) => http("POST", "/saidas", payload),
    },
    ajustes: {
      list: (params) => http("GET", `/ajustes${qs(params)}`),
      create: (payload) => http("POST", "/ajustes", payload),
    },
    health: () => http("GET", "/health"),
  };

  global.apiClient = apiClient;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = apiClient;
  }
})(typeof window !== "undefined" ? window : globalThis);
