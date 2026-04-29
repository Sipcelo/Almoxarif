/* ============================================================
   Almox - Painel Inicial v6 (SDD-004 PR-3 debt cleanup)
   Dados de cards, acessos, atividades e graficos vindos do backend.
   ============================================================ */
const PageDashboard = {
  accessPage: 1,
  _renderToken: 0,
  _latestAccesses: [],

  async render() {
    const token = ++this._renderToken;

    this._renderSkeleton();

    // Busca em paralelo; falha parcial nao derruba as outras.
    const [itemsR, entradasR, saidasR, funcsR, setoresR, ajustesR] = await Promise.allSettled([
      this._listAll((params) => apiClient.items.list(params), "items", token),
      this._listAll((params) => apiClient.entradas.list(params), "entradas", token),
      this._listAll((params) => apiClient.saidas.list(params), "saidas", token),
      this._listAll((params) => apiClient.funcionarios.list(params), "funcionarios", token),
      this._listAll((params) => apiClient.setores.list(params), "setores", token),
      this._listAll((params) => apiClient.ajustes.list(params), "ajustes", token),
    ]);

    if (token !== this._renderToken) return;

    const items = this._unwrap(itemsR, "items");
    const entradas = this._unwrap(entradasR, "entradas");
    const saidas = this._unwrap(saidasR, "saidas");
    const funcs = this._unwrap(funcsR, "funcionarios");
    const setores = this._unwrap(setoresR, "setores");
    const ajustes = this._unwrap(ajustesR, "ajustes");

    this._renderStats(items, entradas, saidas, funcs, setores);
    this._renderTopItems(items);

    const acessos = this._buildAccesses(entradas, saidas);
    this._latestAccesses = acessos;
    this.renderAccessList(acessos);

    this.renderChart("d-mini-chart", this._buildDailySeries(entradas, 9), 65);
    this.renderChart("d-big-chart", this._buildDailySeries(saidas, 9), 105);

    const activities = this._buildActivities(entradas, saidas, ajustes);
    this._renderActivities(activities);

    const de7d = daysAgo(7);
    const hoje = today();
    const saidas7 = saidas
      .filter((s) => isoDate(s.data) >= de7d)
      .reduce((sum, row) => sum + Number(row.qtd || 0), 0);
    const entHoje = entradas
      .filter((e) => isoDate(e.data) === hoje)
      .reduce((sum, row) => sum + Number(row.qtd || 0), 0);

    const sSem = document.getElementById("d-saidas-semana");
    if (sSem) sSem.textContent = String(saidas7);
    const eHoje = document.getElementById("d-entradas-hoje");
    if (eHoje) eHoje.textContent = String(entHoje);
  },

  _renderSkeleton() {
    const stats = document.getElementById("d-stats");
    if (stats) stats.innerHTML = this._statsSkeleton();

    const estoqueBody = document.getElementById("d-estoque-body");
    if (estoqueBody) {
      estoqueBody.innerHTML = `<tr><td colspan="3">${Utils.emptyState("Carregando...")}</td></tr>`;
    }
  },

  _renderStats(items, entradas, saidas, funcs, setores) {
    const totalQtd = items.reduce((sum, i) => sum + Number(i.quantidade || 0), 0);
    const baixo = items.filter((i) => Number(i.quantidade || 0) < Number(i.minimo || 0)).length;
    const de30d = daysAgo(30);
    const saidas30 = saidas
      .filter((s) => isoDate(s.data) >= de30d)
      .reduce((sum, row) => sum + Number(row.qtd || 0), 0);
    const funcAtivos = funcs.filter((f) => f.ativo !== false).length;

    const statsEl = document.getElementById("d-stats");
    if (!statsEl) return;

    statsEl.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon stat-icon-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></div>
        <div class="stat-label">Itens Cadastrados</div>
        <div class="stat-value" data-stat="itens">${items.length}</div>
        <div class="stat-sub">${totalQtd} unidades no total</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon ${baixo > 0 ? "stat-icon-red" : "stat-icon-green"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg></div>
        <div class="stat-label">Abaixo do Minimo</div>
        <div class="stat-value" data-stat="baixo" style="color:${baixo > 0 ? "var(--red)" : "var(--green)"}">${baixo}</div>
        <div class="stat-sub ${baixo > 0 ? "stat-down" : "stat-up"}">${baixo > 0 ? "▼ Requer reposicao" : "▲ Estoque adequado"}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <div class="stat-label">Funcionarios Ativos</div>
        <div class="stat-value" data-stat="funcionarios">${funcAtivos}</div>
        <div class="stat-sub">${setores.length} setores cadastrados</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg></div>
        <div class="stat-label">Saidas este mes</div>
        <div class="stat-value" data-stat="saidas-mes">${saidas30}</div>
        <div class="stat-sub stat-down">▼ Unidades retiradas</div>
      </div>`;
  },

  _renderTopItems(items) {
    const topItems = [...items]
      .sort((a, b) => Number(b.quantidade || 0) - Number(a.quantidade || 0))
      .slice(0, 5);

    const estoqueBody = document.getElementById("d-estoque-body");
    if (!estoqueBody) return;

    estoqueBody.innerHTML =
      topItems
        .map(
          (item) => `
      <tr>
        <td><div class="tbl-item">${Utils.itemIcon()}<div><div class="tbl-name">${item.descricao || ""}</div><div class="tbl-sub" style="font-family:var(--mono)">${item.codigo || ""}</div></div></div></td>
        <td><span class="badge badge-blue">${this._categoriaNome(item)}</span></td>
        <td>${Utils.qtyBadge(item.quantidade || 0, item.minimo || 0)}</td>
      </tr>`
        )
        .join("") || `<tr><td colspan="3">${Utils.emptyState()}</td></tr>`;
  },

  async _listAll(fetchPage, key, token) {
    const limit = 100;
    const first = await fetchPage({ page: 1, limit });
    const rows = this._extractRows(first, key);
    const totalPages = this._extractTotalPages(first);

    if (totalPages <= 1) return rows;

    const restPromises = [];
    for (let page = 2; page <= totalPages; page += 1) {
      restPromises.push(fetchPage({ page, limit }));
    }

    const restPayloads = await Promise.all(restPromises);
    if (token !== this._renderToken) return [];

    const all = [...rows];
    for (const payload of restPayloads) {
      all.push(...this._extractRows(payload, key));
    }
    return all;
  },

  _extractRows(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    const rows = payload[key];
    return Array.isArray(rows) ? rows : [];
  },

  _extractTotalPages(payload) {
    if (!payload || typeof payload !== "object" || !payload.meta) return 1;
    const raw = Number(payload.meta.totalPages);
    if (!Number.isFinite(raw) || raw < 1) return 1;
    return Math.floor(raw);
  },

  _unwrap(settled, label) {
    if (settled.status === "fulfilled") {
      return settled.value;
    }

    const err = settled.reason;
    // 403 e silencioso (usuario sem permissao para aquela listagem); demais notificam.
    if (!(err && err.status === 403)) {
      const msg = (err && err.message) || `Falha ao carregar ${label}.`;
      if (typeof Utils !== "undefined" && Utils.notify) Utils.notify(msg, "error");
    }
    return [];
  },

  _statsSkeleton() {
    const card = `<div class="stat-card"><div class="stat-label">&nbsp;</div><div class="stat-value">-</div><div class="stat-sub">Carregando...</div></div>`;
    return card + card + card + card;
  },

  _categoriaNome(item) {
    if (item && item.categoria && typeof item.categoria === "object") {
      return item.categoria.nome || "-";
    }
    if (item && typeof item.categoria === "string" && item.categoria) {
      return item.categoria;
    }
    return "-";
  },

  _buildAccesses(entradas, saidas) {
    const fromEntradas = entradas.map((entrada) => ({
      nome: this._entradaActor(entrada),
      tipo: "Entrada",
      hora: this._timeOnly(entrada.data),
      data: isoDate(entrada.data),
      _ts: this._ts(entrada.data),
    }));

    const fromSaidas = saidas.map((saida) => ({
      nome: this._saidaActor(saida),
      tipo: "Saida",
      hora: this._timeOnly(saida.data),
      data: isoDate(saida.data),
      _ts: this._ts(saida.data),
    }));

    return [...fromEntradas, ...fromSaidas].sort((a, b) => b._ts - a._ts);
  },

  _buildActivities(entradas, saidas, ajustes) {
    const entradaActivities = entradas.map((entrada) => {
      const itemNome = this._itemNome(entrada.item, entrada.itemId);
      return {
        color: "green",
        text: `<strong>${this._entradaActor(entrada)}</strong>: Entrada de ${itemNome} (+${entrada.qtd || 0})`,
        time: this._relativeTime(entrada.data),
        _ts: this._ts(entrada.data),
      };
    });

    const saidaActivities = saidas.map((saida) => {
      const itemNome = this._itemNome(saida.item, saida.itemId);
      return {
        color: "red",
        text: `<strong>${this._saidaActor(saida)}</strong>: Retirada de ${itemNome} (-${saida.qtd || 0})`,
        time: this._relativeTime(saida.data),
        _ts: this._ts(saida.data),
      };
    });

    const ajusteActivities = ajustes.map((ajuste) => {
      const itemNome = this._itemNome(ajuste.item, ajuste.itemId);
      return {
        color: "blue",
        text: `<strong>${this._ajusteActor(ajuste)}</strong>: Ajuste de ${itemNome} (${ajuste.qtdAnterior} -> ${ajuste.qtdNova})`,
        time: this._relativeTime(ajuste.data),
        _ts: this._ts(ajuste.data),
      };
    });

    return [...entradaActivities, ...saidaActivities, ...ajusteActivities].sort((a, b) => b._ts - a._ts);
  },

  _buildDailySeries(events, days) {
    const map = new Map();
    for (const event of events) {
      const day = isoDate(event.data);
      if (!day) continue;
      map.set(day, (map.get(day) || 0) + Number(event.qtd || 0));
    }

    const points = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      points.push(Number(map.get(daysAgo(i)) || 0));
    }
    return points;
  },

  _activityColor(color) {
    if (color === "green") return "var(--green)";
    if (color === "blue") return "var(--blue)";
    return "var(--red)";
  },

  _itemNome(item, fallbackId) {
    if (item && item.descricao) return item.descricao;
    if (item && item.codigo) return item.codigo;
    if (fallbackId) return `Item ${String(fallbackId).slice(0, 8)}`;
    return "Item";
  },

  _entradaActor(entrada) {
    if (entrada && entrada.responsavel && entrada.responsavel.nome) return entrada.responsavel.nome;
    if (entrada && entrada.responsavelUser && entrada.responsavelUser.nome) return entrada.responsavelUser.nome;
    if (entrada && entrada.responsavelUserId) return `Usuario ${String(entrada.responsavelUserId).slice(0, 8)}`;
    return "Usuario";
  },

  _saidaActor(saida) {
    if (saida && saida.funcionario && saida.funcionario.nome) return saida.funcionario.nome;
    if (saida && saida.funcionarioNome) return saida.funcionarioNome;
    if (saida && saida.funcionarioId) return `Funcionario ${String(saida.funcionarioId).slice(0, 8)}`;
    return "Funcionario";
  },

  _ajusteActor(ajuste) {
    if (ajuste && ajuste.responsavel && ajuste.responsavel.nome) return ajuste.responsavel.nome;
    if (ajuste && ajuste.responsavelUser && ajuste.responsavelUser.nome) return ajuste.responsavelUser.nome;
    if (ajuste && ajuste.responsavelUserId) return `Usuario ${String(ajuste.responsavelUserId).slice(0, 8)}`;
    return "Usuario";
  },

  _ts(raw) {
    const ts = new Date(raw || 0).getTime();
    return Number.isFinite(ts) ? ts : 0;
  },

  _timeOnly(raw) {
    if (!raw) return "--:--";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "--:--";
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  },

  _relativeTime(raw) {
    const ts = this._ts(raw);
    if (!ts) return "";
    const diffMs = Date.now() - ts;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Agora";
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "1 dia";
    return `${days} dias`;
  },

  _renderActivities(activities) {
    const activitiesEl = document.getElementById("d-activities");
    if (!activitiesEl) return;

    activitiesEl.innerHTML =
      activities
        .slice(0, 6)
        .map(
          (a) => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);">
        <div style="width:8px;height:8px;border-radius:50%;background:${this._activityColor(a.color)};flex-shrink:0;margin-top:5px;"></div>
        <div><div style="font-size:12.5px;line-height:1.5;">${a.text}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px;">${a.time}</div></div>
      </div>`
        )
        .join("") || Utils.emptyState();
  },

  renderAccessList(acessos = this._latestAccesses, filter = "") {
    const f = filter.toLowerCase();
    const filtered = acessos.filter((a) => {
      const name = (a && a.nome) || "";
      return !f || name.toLowerCase().includes(f);
    });
    const perPage = 4;
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (this.accessPage > totalPages) this.accessPage = 1;

    const slice = filtered.slice((this.accessPage - 1) * perPage, this.accessPage * perPage);
    document.getElementById("d-access-list").innerHTML =
      slice
        .map(
          (a) => `
      <div style="display:flex;align-items:center;gap:11px;padding:11px 16px;border-bottom:1px solid var(--border);">
        ${Utils.avatarHtml(a.nome, "md")}
        <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:500;">${a.nome} <span style="color:var(--text-3);font-size:12px;">${a.hora}</span></div>
          <span class="badge ${a.tipo === "Entrada" ? "badge-green" : "badge-red"} badge-dot">${a.tipo}</span>
        </div>
        <div style="text-align:right;flex-shrink:0;font-size:11.5px;color:var(--text-3);">${Utils.relDate(a.data)}</div>
      </div>`
        )
        .join("") || Utils.emptyState();

    document.getElementById("d-access-pagination").innerHTML = `
      <button class="page-btn" onclick="PageDashboard.accessPage=1;PageDashboard.renderAccessList(PageDashboard._latestAccesses)">«</button>
      <button class="page-btn" onclick="if(PageDashboard.accessPage>1){PageDashboard.accessPage--;PageDashboard.renderAccessList(PageDashboard._latestAccesses)}">‹</button>
      <span class="page-info">${this.accessPage}/${totalPages}</span>
      <button class="page-btn" onclick="if(PageDashboard.accessPage<${totalPages}){PageDashboard.accessPage++;PageDashboard.renderAccessList(PageDashboard._latestAccesses)}">›</button>
      <button class="page-btn" onclick="PageDashboard.accessPage=${totalPages};PageDashboard.renderAccessList(PageDashboard._latestAccesses)">»</button>`;
  },

  renderChart(id, data, h) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!Array.isArray(data) || data.length === 0) {
      el.innerHTML = "";
      return;
    }

    const max = Math.max(1, ...data);
    el.innerHTML = data
      .map((v) => `<div class="bar-col"><div class="bar" style="height:${Math.round((Number(v || 0) / max) * h)}px"></div></div>`)
      .join("");
  },
};

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function isoDate(v) {
  if (!v) return "";
  if (typeof v === "string") return v.length >= 10 ? v.slice(0, 10) : v;
  try {
    return new Date(v).toISOString().split("T")[0];
  } catch (_) {
    return "";
  }
}
