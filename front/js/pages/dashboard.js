/* ============================================================
   Almox — Painel Inicial v5 (SDD-004 PR-3)
   Agora consumindo backend via apiClient.
   Débitos (documentados em SPEC PR-3):
     - Controle de Acesso (alm_acessos) permanece em localStorage até PR própria.
     - App.activities permanece mock até SDD-005 (auditLog).
     - Agregação client-side com limit=500 (débito até SDD-005 agregador).
   ============================================================ */
const PageDashboard = {
  accessPage: 1,
  _renderToken: 0,

  async render() {
    const token = ++this._renderToken;

    // Render skeleton imediato
    document.getElementById("d-stats").innerHTML = this._statsSkeleton();
    document.getElementById("d-estoque-body").innerHTML =
      `<tr><td colspan="3">${Utils.emptyState("Carregando…")}</td></tr>`;

    // Busca em paralelo — falha parcial não derruba as outras.
    const [itemsR, entradasR, saidasR, funcsR, setoresR] = await Promise.allSettled([
      apiClient.items.list({ limit: 500 }),
      apiClient.entradas.list({ limit: 500 }),
      apiClient.saidas.list({ limit: 500 }),
      apiClient.funcionarios.list({ limit: 500 }),
      apiClient.setores.list({ limit: 500 }),
    ]);

    // Se o usuário já pulou para outra página, descarta.
    if (token !== this._renderToken) return;

    const items = this._unwrap(itemsR, "items");
    const entradas = this._unwrap(entradasR, "entradas");
    const saidas = this._unwrap(saidasR, "saidas");
    const funcs = this._unwrap(funcsR, "funcionarios");
    const setores = this._unwrap(setoresR, "setores");

    // ------- Cards -------
    const totalQtd = items.reduce((s, i) => s + (i.quantidade || 0), 0);
    const baixo = items.filter((i) => (i.quantidade || 0) < (i.minimo || 0)).length;
    const hoje = today();
    const de30d = daysAgo(30);
    const de7d = daysAgo(7);
    const entHoje = entradas
      .filter((e) => isoDate(e.data) === hoje)
      .reduce((s, e) => s + (e.qtd || 0), 0);
    const saidas30 = saidas
      .filter((s) => isoDate(s.data) >= de30d)
      .reduce((s, x) => s + (x.qtd || 0), 0);
    const saidas7 = saidas
      .filter((s) => isoDate(s.data) >= de7d)
      .reduce((s, x) => s + (x.qtd || 0), 0);
    const funcAtivos = funcs.filter((f) => f.ativo !== false).length;

    document.getElementById("d-stats").innerHTML = `
      <div class="stat-card">
        <div class="stat-icon stat-icon-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></div>
        <div class="stat-label">Itens Cadastrados</div>
        <div class="stat-value" data-stat="itens">${items.length}</div>
        <div class="stat-sub">${totalQtd} unidades no total</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon ${baixo > 0 ? "stat-icon-red" : "stat-icon-green"}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg></div>
        <div class="stat-label">Abaixo do Mínimo</div>
        <div class="stat-value" data-stat="baixo" style="color:${baixo > 0 ? "var(--red)" : "var(--green)"}">${baixo}</div>
        <div class="stat-sub ${baixo > 0 ? "stat-down" : "stat-up"}">${baixo > 0 ? "▼ Requer reposição" : "▲ Estoque adequado"}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <div class="stat-label">Funcionários Ativos</div>
        <div class="stat-value" data-stat="funcionarios">${funcAtivos}</div>
        <div class="stat-sub">${setores.length} setores cadastrados</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg></div>
        <div class="stat-label">Saídas este mês</div>
        <div class="stat-value" data-stat="saidas-mes">${saidas30}</div>
        <div class="stat-sub stat-down">▼ Unidades retiradas</div>
      </div>`;

    // ------- Top 5 estoque -------
    const topItems = [...items].sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0)).slice(0, 5);
    document.getElementById("d-estoque-body").innerHTML =
      topItems
        .map(
          (i) => `
      <tr>
        <td><div class="tbl-item">${Utils.itemIcon()}<div><div class="tbl-name">${i.descricao || ""}</div><div class="tbl-sub" style="font-family:var(--mono)">${i.codigo || ""}</div></div></div></td>
        <td><span class="badge badge-blue">${(i.categoria && i.categoria.nome) || "—"}</span></td>
        <td>${Utils.qtyBadge(i.quantidade || 0, i.minimo || 0)}</td>
      </tr>`
        )
        .join("") || `<tr><td colspan="3">${Utils.emptyState()}</td></tr>`;

    // ------- Controle de acesso (legado, débito L-D1) -------
    const acessos = typeof Store !== "undefined" && Store.getAcessos ? Store.getAcessos() : [];
    this.renderAccessList(acessos);

    // ------- Gráficos (mock mantido) -------
    this.renderChart("d-mini-chart", [32, 38, 45, 28, 55, 42, 38, 50, 58], 65);
    this.renderChart("d-big-chart", [32, 38, 45, 28, 55, 42, 38, 50, 58], 105);

    // ------- Atividades (mock mantido, débito L-D2) -------
    document.getElementById("d-activities").innerHTML =
      App.activities
        .slice(0, 6)
        .map(
          (a) => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);">
        <div style="width:8px;height:8px;border-radius:50%;background:${a.color === "green" ? "var(--green)" : "var(--red)"};flex-shrink:0;margin-top:5px;"></div>
        <div><div style="font-size:12.5px;line-height:1.5;">${a.text}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px;">${a.time}</div></div>
      </div>`
        )
        .join("") || Utils.emptyState();

    const sSem = document.getElementById("d-saidas-semana");
    if (sSem) sSem.textContent = String(saidas7);
    const eHoje = document.getElementById("d-entradas-hoje");
    if (eHoje) eHoje.textContent = String(entHoje);
  },

  _unwrap(settled, label) {
    if (settled.status === "fulfilled") {
      const v = settled.value;
      if (Array.isArray(v)) return v;
      if (v && Array.isArray(v.items)) return v.items;
      return [];
    }
    const err = settled.reason;
    // 403 é silencioso (usuário sem permissão para aquela listagem); demais notificam.
    if (!(err && err.status === 403)) {
      const msg = (err && err.message) || `Falha ao carregar ${label}.`;
      if (typeof Utils !== "undefined" && Utils.notify) Utils.notify(msg, "error");
    }
    return [];
  },

  _statsSkeleton() {
    const card = `<div class="stat-card"><div class="stat-label">&nbsp;</div><div class="stat-value">—</div><div class="stat-sub">Carregando…</div></div>`;
    return card + card + card + card;
  },

  renderAccessList(acessos, filter = "") {
    const f = filter.toLowerCase();
    const filtered = acessos.filter((a) => !f || a.nome.toLowerCase().includes(f));
    const perPage = 4,
      total = filtered.length,
      totalPages = Math.max(1, Math.ceil(total / perPage));
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
      <button class="page-btn" onclick="PageDashboard.accessPage=1;PageDashboard.renderAccessList(Store.getAcessos())">«</button>
      <button class="page-btn" onclick="if(PageDashboard.accessPage>1){PageDashboard.accessPage--;PageDashboard.renderAccessList(Store.getAcessos())}">‹</button>
      <span class="page-info">${this.accessPage}/${totalPages}</span>
      <button class="page-btn" onclick="if(PageDashboard.accessPage<${totalPages}){PageDashboard.accessPage++;PageDashboard.renderAccessList(Store.getAcessos())}">›</button>
      <button class="page-btn" onclick="PageDashboard.accessPage=${totalPages};PageDashboard.renderAccessList(Store.getAcessos())">»</button>`;
  },

  renderChart(id, data, h) {
    const el = document.getElementById(id);
    if (!el) return;
    const max = Math.max(...data);
    el.innerHTML = data
      .map((v) => `<div class="bar-col"><div class="bar" style="height:${Math.round((v / max) * h)}px"></div></div>`)
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
