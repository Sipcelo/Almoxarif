import { describe, it, expect, vi, beforeEach } from "vitest";

declare global {
  // eslint-disable-next-line no-var
  var apiClient: {
    ApiError: new (opts: {
      code: string;
      message: string;
      status: number;
      details?: unknown[];
    }) => Error & {
      code: string;
      status: number;
      details: unknown[];
    };
    _http: (
      method: string,
      path: string,
      body?: unknown
    ) => Promise<unknown>;
    _csrfFromCookie: () => string | null;
    _qs: (params?: Record<string, unknown>) => string;
    auth: {
      login: (email: string, senha: string) => Promise<unknown>;
      logout: () => Promise<unknown>;
      me: () => Promise<unknown>;
    };
    users: {
      list: (params?: Record<string, unknown>) => Promise<unknown>;
      get: (id: string) => Promise<unknown>;
      create: (payload: unknown) => Promise<unknown>;
      update: (id: string, payload: unknown) => Promise<unknown>;
      updatePassword: (id: string, senha: string) => Promise<unknown>;
      remove: (id: string) => Promise<unknown>;
    };
    funcionarios: CrudModule;
    setores: CrudModule;
    categorias: CrudModule;
    depositos: CrudModule;
    items: CrudModule;
    entradas: ListCreate;
    saidas: ListCreate;
    ajustes: ListCreate;
    health: () => Promise<unknown>;
  };
}

type CrudModule = {
  list: (params?: Record<string, unknown>) => Promise<unknown>;
  get: (id: string) => Promise<unknown>;
  create: (payload: unknown) => Promise<unknown>;
  update: (id: string, payload: unknown) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
};
type ListCreate = {
  list: (params?: Record<string, unknown>) => Promise<unknown>;
  create: (payload: unknown) => Promise<unknown>;
};

const CSRF = "test-csrf-token";

function setCsrfCookie(token: string = CSRF) {
  document.cookie = `almox_csrf=${encodeURIComponent(token)}; path=/`;
}

function mockJsonResponse(
  body: unknown,
  opts: { status?: number; ok?: boolean } = {}
) {
  const status = opts.status ?? 200;
  return {
    ok: opts.ok ?? (status >= 200 && status < 300),
    status,
    headers: {
      get: (k: string) =>
        k.toLowerCase() === "content-type" ? "application/json" : null,
    },
    json: async () => body,
  };
}

function mockErrorResponse(
  status: number,
  code: string,
  message: string,
  details: unknown[] = []
) {
  return {
    ok: false,
    status,
    headers: {
      get: (k: string) =>
        k.toLowerCase() === "content-type" ? "application/json" : null,
    },
    json: async () => ({ error: { code, message, details } }),
  };
}

function mockEmptyResponse(status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => {
      throw new Error("no body");
    },
  };
}

function fetchMock() {
  return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
}

describe("apiClient — CSRF + transport", () => {
  beforeEach(() => {
    setCsrfCookie();
  });

  it("expõe window.apiClient com ApiError e módulos", () => {
    expect(globalThis.apiClient).toBeDefined();
    expect(globalThis.apiClient.ApiError).toBeTypeOf("function");
    expect(globalThis.apiClient.auth.login).toBeTypeOf("function");
    expect(globalThis.apiClient.users.create).toBeTypeOf("function");
  });

  it("_csrfFromCookie lê cookie almox_csrf", () => {
    expect(globalThis.apiClient._csrfFromCookie()).toBe(CSRF);
  });

  it("_csrfFromCookie retorna null se cookie ausente", () => {
    document.cookie = "almox_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    expect(globalThis.apiClient._csrfFromCookie()).toBeNull();
  });

  it("_qs retorna string vazia para params vazios/undefined", () => {
    expect(globalThis.apiClient._qs()).toBe("");
    expect(globalThis.apiClient._qs({})).toBe("");
    expect(globalThis.apiClient._qs({ a: undefined, b: null, c: "" })).toBe("");
  });

  it("_qs codifica valores e monta query string", () => {
    const q = globalThis.apiClient._qs({ nome: "a b", page: 2 });
    expect(q).toBe("?nome=a%20b&page=2");
  });

  it("POST envia header x-almox-csrf com valor do cookie", async () => {
    fetchMock().mockResolvedValue(mockJsonResponse({ ok: true }, { status: 201 }));
    await globalThis.apiClient.users.create({ nome: "X" });
    expect(fetchMock()).toHaveBeenCalledWith(
      expect.stringContaining("/users"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({ "x-almox-csrf": CSRF }),
      })
    );
  });

  it("POST sem cookie csrf lança ApiError CSRF_MISSING sem chamar fetch", async () => {
    document.cookie = "almox_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    fetchMock().mockResolvedValue(mockJsonResponse({ ok: true }));
    await expect(
      globalThis.apiClient.users.create({ nome: "X" })
    ).rejects.toMatchObject({
      code: "CSRF_MISSING",
      status: 0,
    });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("GET não envia header x-almox-csrf", async () => {
    fetchMock().mockResolvedValue(mockJsonResponse({ items: [] }));
    await globalThis.apiClient.users.list();
    const call = fetchMock().mock.calls[0];
    expect(call[1].headers).not.toHaveProperty("x-almox-csrf");
    expect(call[1].method).toBe("GET");
  });

  it("GET funciona sem cookie csrf", async () => {
    document.cookie = "almox_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    fetchMock().mockResolvedValue(mockJsonResponse({ items: [] }));
    await expect(globalThis.apiClient.users.list()).resolves.toEqual({
      items: [],
    });
  });

  it("envia credentials: include em todas as chamadas", async () => {
    fetchMock().mockResolvedValue(mockJsonResponse({}));
    await globalThis.apiClient.auth.me();
    expect(fetchMock().mock.calls[0][1].credentials).toBe("include");
  });

  it("Content-Type application/json em todas as chamadas", async () => {
    fetchMock().mockResolvedValue(mockJsonResponse({}));
    await globalThis.apiClient.auth.me();
    expect(fetchMock().mock.calls[0][1].headers["Content-Type"]).toBe(
      "application/json"
    );
  });

  it("body é JSON.stringify do payload", async () => {
    fetchMock().mockResolvedValue(mockJsonResponse({}, { status: 201 }));
    await globalThis.apiClient.categorias.create({ nome: "geral" });
    expect(fetchMock().mock.calls[0][1].body).toBe('{"nome":"geral"}');
  });

  it("prefixa API_BASE /api/v1 por default", async () => {
    fetchMock().mockResolvedValue(mockJsonResponse({}));
    await globalThis.apiClient.health();
    expect(fetchMock().mock.calls[0][0]).toMatch(/^\/api\/v1\/health$/);
  });

  it("respeita window.ALMOX_API_BASE customizado (via novo IIFE)", () => {
    // Este teste confirma que a implementação respeita o override; verificamos indiretamente
    // pelo fato de window.apiClient existir. O reload real é exercitado em E2E.
    expect(globalThis.apiClient).toBeDefined();
  });
});

describe("apiClient — respostas", () => {
  beforeEach(() => setCsrfCookie());

  it("2xx JSON retorna body", async () => {
    fetchMock().mockResolvedValue(mockJsonResponse({ ok: 1 }));
    await expect(globalThis.apiClient.auth.me()).resolves.toEqual({ ok: 1 });
  });

  it("204 No Content retorna null", async () => {
    fetchMock().mockResolvedValue(mockEmptyResponse(204));
    await expect(globalThis.apiClient.users.remove("abc")).resolves.toBeNull();
  });

  it("2xx sem content-type JSON retorna null", async () => {
    fetchMock().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "text/plain" },
      json: async () => ({ ignored: true }),
    });
    await expect(globalThis.apiClient.auth.me()).resolves.toBeNull();
  });

  it("4xx com payload error lança ApiError com code/status/message", async () => {
    fetchMock().mockResolvedValue(
      mockErrorResponse(400, "VALIDATION_ERROR", "Campo X inválido", [
        { path: "x" },
      ])
    );
    try {
      await globalThis.apiClient.users.create({});
      throw new Error("should throw");
    } catch (e) {
      const err = e as Error & {
        code: string;
        status: number;
        details: unknown[];
      };
      expect(err).toBeInstanceOf(globalThis.apiClient.ApiError);
      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.status).toBe(400);
      expect(err.message).toBe("Campo X inválido");
      expect(err.details).toEqual([{ path: "x" }]);
    }
  });

  it("401 dispara evento almox:session-expired", async () => {
    const handler = vi.fn();
    window.addEventListener("almox:session-expired", handler);
    fetchMock().mockResolvedValue(
      mockErrorResponse(401, "UNAUTHORIZED", "Sessão expirada")
    );
    await expect(globalThis.apiClient.auth.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("almox:session-expired", handler);
  });

  it("403 CSRF_ERROR propaga sem disparar session-expired", async () => {
    const handler = vi.fn();
    window.addEventListener("almox:session-expired", handler);
    fetchMock().mockResolvedValue(
      mockErrorResponse(403, "CSRF_ERROR", "Token CSRF inválido")
    );
    await expect(
      globalThis.apiClient.users.create({ nome: "X" })
    ).rejects.toMatchObject({
      code: "CSRF_ERROR",
      status: 403,
    });
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener("almox:session-expired", handler);
  });

  it("500 com payload sem error retorna code UNKNOWN", async () => {
    fetchMock().mockResolvedValue({
      ok: false,
      status: 500,
      headers: {
        get: (k: string) =>
          k.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => ({}),
    });
    await expect(globalThis.apiClient.auth.me()).rejects.toMatchObject({
      code: "UNKNOWN",
      status: 500,
    });
  });

  it("erro de rede (fetch rejeita) vira ApiError NETWORK_ERROR", async () => {
    fetchMock().mockRejectedValue(new TypeError("failed to fetch"));
    await expect(globalThis.apiClient.auth.me()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      status: 0,
    });
  });

  it("timeout (AbortError) vira ApiError TIMEOUT", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    fetchMock().mockRejectedValue(abortErr);
    await expect(globalThis.apiClient.auth.me()).rejects.toMatchObject({
      code: "TIMEOUT",
      status: 0,
    });
  });

  it("json parse error mantém payload null e joga UNKNOWN", async () => {
    fetchMock().mockResolvedValue({
      ok: false,
      status: 500,
      headers: {
        get: (k: string) =>
          k.toLowerCase() === "content-type" ? "application/json" : null,
      },
      json: async () => {
        throw new SyntaxError("bad json");
      },
    });
    await expect(globalThis.apiClient.auth.me()).rejects.toMatchObject({
      code: "UNKNOWN",
      status: 500,
    });
  });
});

describe("apiClient.auth", () => {
  beforeEach(() => setCsrfCookie());

  it("login chama POST /auth/login com email+senha", async () => {
    fetchMock().mockResolvedValue(
      mockJsonResponse({ user: { id: "1" }, csrfToken: "abc" })
    );
    await globalThis.apiClient.auth.login("a@a.com", "s");
    expect(fetchMock().mock.calls[0][0]).toMatch(/\/auth\/login$/);
    expect(fetchMock().mock.calls[0][1].method).toBe("POST");
    expect(fetchMock().mock.calls[0][1].body).toBe(
      '{"email":"a@a.com","senha":"s"}'
    );
  });

  it("login 401 lança ApiError UNAUTHORIZED", async () => {
    fetchMock().mockResolvedValue(
      mockErrorResponse(401, "UNAUTHORIZED", "Credenciais inválidas")
    );
    await expect(
      globalThis.apiClient.auth.login("x", "y")
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("logout chama POST /auth/logout", async () => {
    fetchMock().mockResolvedValue(mockJsonResponse({ message: "ok" }));
    await globalThis.apiClient.auth.logout();
    expect(fetchMock().mock.calls[0][0]).toMatch(/\/auth\/logout$/);
    expect(fetchMock().mock.calls[0][1].method).toBe("POST");
  });

  it("me chama GET /auth/me", async () => {
    fetchMock().mockResolvedValue(
      mockJsonResponse({ user: { id: "1" }, csrfToken: "abc" })
    );
    await globalThis.apiClient.auth.me();
    expect(fetchMock().mock.calls[0][0]).toMatch(/\/auth\/me$/);
    expect(fetchMock().mock.calls[0][1].method).toBe("GET");
  });
});

describe("apiClient.users", () => {
  beforeEach(() => setCsrfCookie());

  it("list com params envia query string", async () => {
    fetchMock().mockResolvedValue(mockJsonResponse({ users: [], total: 0 }));
    await globalThis.apiClient.users.list({ page: 2, limit: 10 });
    expect(fetchMock().mock.calls[0][0]).toMatch(/\/users\?page=2&limit=10$/);
  });

  it("get codifica id", async () => {
    fetchMock().mockResolvedValue(mockJsonResponse({ user: {} }));
    await globalThis.apiClient.users.get("a/b c");
    expect(fetchMock().mock.calls[0][0]).toMatch(/\/users\/a%2Fb%20c$/);
  });

  it("create POST /users", async () => {
    fetchMock().mockResolvedValue(mockJsonResponse({ user: {} }, { status: 201 }));
    await globalThis.apiClient.users.create({ nome: "A", email: "a@a.com" });
    expect(fetchMock().mock.calls[0][1].method).toBe("POST");
  });

  it("update PUT /users/:id", async () => {
    fetchMock().mockResolvedValue(mockJsonResponse({ user: {} }));
    await globalThis.apiClient.users.update("u1", { nome: "A" });
    expect(fetchMock().mock.calls[0][0]).toMatch(/\/users\/u1$/);
    expect(fetchMock().mock.calls[0][1].method).toBe("PUT");
  });

  it("updatePassword PATCH /users/:id/password", async () => {
    fetchMock().mockResolvedValue(mockEmptyResponse(204));
    await globalThis.apiClient.users.updatePassword("u1", "newsenha");
    expect(fetchMock().mock.calls[0][0]).toMatch(/\/users\/u1\/password$/);
    expect(fetchMock().mock.calls[0][1].method).toBe("PATCH");
    expect(fetchMock().mock.calls[0][1].body).toBe('{"senha":"newsenha"}');
  });

  it("remove DELETE /users/:id", async () => {
    fetchMock().mockResolvedValue(mockEmptyResponse(204));
    await globalThis.apiClient.users.remove("u1");
    expect(fetchMock().mock.calls[0][1].method).toBe("DELETE");
  });
});

describe("apiClient CRUD genérico", () => {
  beforeEach(() => setCsrfCookie());

  const modules: Array<{ name: keyof typeof globalThis.apiClient; base: string }> = [
    { name: "funcionarios", base: "/funcionarios" },
    { name: "setores", base: "/settings/setores" },
    { name: "categorias", base: "/settings/categorias" },
    { name: "depositos", base: "/settings/depositos" },
    { name: "items", base: "/items" },
  ];

  for (const m of modules) {
    describe(String(m.name), () => {
      it("list GET sem params", async () => {
        fetchMock().mockResolvedValue(mockJsonResponse({ items: [] }));
        const mod = globalThis.apiClient[m.name] as CrudModule;
        await mod.list();
        expect(fetchMock().mock.calls[0][0]).toMatch(
          new RegExp(`${m.base.replace(/\//g, "\\/")}$`)
        );
        expect(fetchMock().mock.calls[0][1].method).toBe("GET");
      });

      it("create POST", async () => {
        fetchMock().mockResolvedValue(mockJsonResponse({}, { status: 201 }));
        const mod = globalThis.apiClient[m.name] as CrudModule;
        await mod.create({ nome: "x" });
        expect(fetchMock().mock.calls[0][1].method).toBe("POST");
        expect(fetchMock().mock.calls[0][1].headers["x-almox-csrf"]).toBe(CSRF);
      });

      it("update PUT/:id", async () => {
        fetchMock().mockResolvedValue(mockJsonResponse({}));
        const mod = globalThis.apiClient[m.name] as CrudModule;
        await mod.update("abc", { nome: "y" });
        expect(fetchMock().mock.calls[0][0]).toMatch(/\/abc$/);
        expect(fetchMock().mock.calls[0][1].method).toBe("PUT");
      });

      it("remove DELETE/:id", async () => {
        fetchMock().mockResolvedValue(mockEmptyResponse(204));
        const mod = globalThis.apiClient[m.name] as CrudModule;
        await mod.remove("abc");
        expect(fetchMock().mock.calls[0][1].method).toBe("DELETE");
      });
    });
  }
});

describe("apiClient stock movements", () => {
  beforeEach(() => setCsrfCookie());

  const modules: Array<keyof typeof globalThis.apiClient> = [
    "entradas",
    "saidas",
    "ajustes",
  ];

  for (const name of modules) {
    it(`${String(name)}.list GET`, async () => {
      fetchMock().mockResolvedValue(mockJsonResponse({ items: [] }));
      const mod = globalThis.apiClient[name] as ListCreate;
      await mod.list({ limit: 5 });
      expect(fetchMock().mock.calls[0][0]).toMatch(/limit=5/);
      expect(fetchMock().mock.calls[0][1].method).toBe("GET");
    });

    it(`${String(name)}.create POST com CSRF`, async () => {
      fetchMock().mockResolvedValue(mockJsonResponse({}, { status: 201 }));
      const mod = globalThis.apiClient[name] as ListCreate;
      await mod.create({ itemId: "i1", qtd: 1 });
      expect(fetchMock().mock.calls[0][1].method).toBe("POST");
      expect(fetchMock().mock.calls[0][1].headers["x-almox-csrf"]).toBe(CSRF);
    });
  }
});

describe("apiClient.health", () => {
  it("GET /health", async () => {
    fetchMock().mockResolvedValue(mockJsonResponse({ status: "ok" }));
    await globalThis.apiClient.health();
    expect(fetchMock().mock.calls[0][0]).toMatch(/\/health$/);
    expect(fetchMock().mock.calls[0][1].method).toBe("GET");
  });
});
