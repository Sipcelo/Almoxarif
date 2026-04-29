/* ============================================================
   Almox â€” Pages v4
   ============================================================ */

// ---- ESTOQUE ----
const PageEstoque = {
  _sortDir: 'none',
  _renderToken: 0,

  _extractRows(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    const rows = payload[key];
    return Array.isArray(rows) ? rows : [];
  },

  _extractTotalPages(payload) {
    if (!payload || typeof payload !== 'object' || !payload.meta) return 1;
    const raw = Number(payload.meta.totalPages);
    if (!Number.isFinite(raw) || raw < 1) return 1;
    return Math.floor(raw);
  },

  async _listAll(fetchPage, key) {
    const limit = 100;
    const first = await fetchPage({ page: 1, limit, ativo: true });
    const rows = this._extractRows(first, key);
    const totalPages = this._extractTotalPages(first);
    if (totalPages <= 1) return rows;

    const chunks = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, idx) => fetchPage({ page: idx + 2, limit, ativo: true }))
    );

    const all = [...rows];
    for (const payload of chunks) {
      all.push(...this._extractRows(payload, key));
    }
    return all;
  },

  _normalizeItem(raw) {
    return {
      id: String(raw?.id || ''),
      codigo: raw?.codigo || '',
      descricao: raw?.descricao || '',
      categoria: raw?.categoria?.nome || '',
      deposito: raw?.deposito?.nome || '',
      quantidade: Number(raw?.quantidade || 0),
      minimo: Number(raw?.minimo || 0),
      valor: Number(raw?.valorAtual || 0),
      obs: raw?.obs || '',
      ativo: raw?.ativo !== false,
    };
  },

  _onclickId(id) {
    return JSON.stringify(String(id));
  },

  async render(filter='') {
    const token = ++this._renderToken;
    const tableEl = document.getElementById('est-table');
    if (!tableEl) return;
    tableEl.innerHTML = Utils.emptyState('Carregando itens...');

    try {
      const [itemsRaw, categoriasRaw, depositosRaw] = await Promise.all([
        this._listAll((params) => apiClient.items.list(params), 'items'),
        this._listAll((params) => apiClient.categorias.list(params), 'categorias'),
        this._listAll((params) => apiClient.depositos.list(params), 'depositos'),
      ]);
      if (token !== this._renderToken) return;

      const items = itemsRaw.map((row) => this._normalizeItem(row)).filter((i) => i.ativo !== false);
      const categorias = categoriasRaw.map((c) => c.nome).filter(Boolean);
      const depositos = depositosRaw.map((d) => d.nome).filter(Boolean);

      const q=(document.getElementById('est-search')?.value||filter).toLowerCase();
      const catF=document.getElementById('flt-cat')?.value||'';
      const depF=document.getElementById('flt-dep')?.value||'';
      const qtdMin=parseInt(document.getElementById('flt-qtd-min')?.value)||0;
      const qtdMax=document.getElementById('flt-qtd-max')?.value!==''?parseInt(document.getElementById('flt-qtd-max')?.value):Infinity;
      const statusF=document.getElementById('flt-status')?.value||'';
      const cs=document.getElementById('flt-cat'),ds=document.getElementById('flt-dep');
      if(cs){const v=cs.value;cs.innerHTML='<option value="">Todas categorias</option>'+categorias.map(c=>`<option value="${c}"${c===v?' selected':''}>${c}</option>`).join('');}
      if(ds){const v=ds.value;ds.innerHTML='<option value="">Todos depÃ³sitos</option>'+depositos.map(d=>`<option value="${d}"${d===v?' selected':''}>${d}</option>`).join('');}
      let list=items.filter(i=>{
        const matchQ=!q||i.descricao.toLowerCase().includes(q)||i.categoria.toLowerCase().includes(q)||(i.codigo||'').toLowerCase().includes(q);
        const matchCat=!catF||i.categoria===catF;
        const matchDep=!depF||i.deposito===depF;
        const matchQMin=i.quantidade>=qtdMin, matchQMax=i.quantidade<=qtdMax;
        const matchSt=!statusF||(statusF==='ok'&&i.quantidade>=i.minimo)||(statusF==='baixo'&&i.quantidade>0&&i.quantidade<i.minimo)||(statusF==='zero'&&i.quantidade===0);
        return matchQ&&matchCat&&matchDep&&matchQMin&&matchQMax&&matchSt;
      });
      if(this._sortDir==='asc')  list.sort((a,b)=>a.quantidade-b.quantidade);
      if(this._sortDir==='desc') list.sort((a,b)=>b.quantidade-a.quantidade);
      const ce=document.getElementById('est-count');
      if(ce)ce.textContent=list.length===items.length?`${items.length} itens`:`${list.length} de ${items.length} itens`;
      const canEdit=Auth.isAdmin()||Auth.currentUser?.role==='gerente';
      tableEl.innerHTML=list.length===0?Utils.emptyState('Nenhum item encontrado','Tente alterar os filtros.'):`
      <table><thead><tr>
        <th>CÃ³d.</th><th>DescriÃ§Ã£o</th><th>Categoria</th><th>DepÃ³sito</th>
        <th style="text-align:center;cursor:pointer" onclick="PageEstoque.toggleSort()" title="Ordenar por quantidade">
          Qtd. <span style="font-size:11px;color:var(--brand)">${this._sortDir==='desc'?'v':'^'}</span>
        </th>
        <th style="text-align:center">MÃ­n.</th>
        <th style="text-align:right">Valor Unit.</th>
        <th style="text-align:center">Status</th>
        ${canEdit?'<th>AÃ§Ãµes</th>':''}
      </tr></thead><tbody>
      ${list.map(i=>{
        const idArg = this._onclickId(i.id);
        const semEstoque=i.quantidade===0,baixo=i.quantidade>0&&i.quantidade<i.minimo;
        const statusBadge=semEstoque?`<span class="badge badge-red">Sem estoque</span>`:baixo?`<span class="badge badge-orange">Baixo</span>`:`<span class="badge badge-green">Ok</span>`;
        return `<tr>
          <td><span style="font-size:12px;font-family:var(--mono);color:var(--brand);font-weight:500">${i.codigo||'â€”'}</span></td>
          <td><div class="tbl-item">${Utils.itemIcon()}<div><div class="tbl-name">${i.descricao}</div><div class="tbl-sub">${i.obs||'â€”'}</div></div></div></td>
          <td><span class="badge badge-blue">${i.categoria}</span></td>
          <td><span style="font-size:12.5px;color:var(--text-2)">${i.deposito}</span></td>
          <td style="text-align:center">${Utils.qtyBadge(i.quantidade,i.minimo)}</td>
          <td style="text-align:center"><span style="font-size:12.5px;color:var(--text-3)">${i.minimo}</span></td>
          <td style="text-align:right"><span style="font-size:12.5px;font-family:var(--mono)">R$ ${(i.valor||0).toFixed(2)}</span></td>
          <td style="text-align:center">${statusBadge}</td>
          ${canEdit?`<td><div class="tbl-actions">
            <button class="btn-icon" title="Entrada" onclick='Modals.openEntradaFor(${idArg})'><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg></button>
            <button class="btn-icon" title="SaÃ­da"   onclick='Modals.openSaidaFor(${idArg})'><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
            <button class="btn-icon" title="Editar"  onclick='Modals.editItem(${idArg})'><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            ${Auth.isAdmin()?`<button class="btn-icon danger" title="Excluir" onclick='Modals.deleteItem(${idArg})'><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`:''}
          </div></td>`:''}
        </tr>`;
      }).join('')}
      </tbody></table>`;
    } catch (err) {
      if (token !== this._renderToken) return;
      tableEl.innerHTML = Utils.emptyState('Falha ao carregar itens');
      const msg = (err && err.message) || 'Falha ao carregar itens.';
      Utils.notify(msg, 'error');
    }
  },
  toggleSort(){
    this._sortDir=(this._sortDir==='none'||this._sortDir==='desc')?'asc':'desc';
    this.render();
  },
  clearFilters(){
    ['est-search','flt-qtd-min','flt-qtd-max'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    ['flt-cat','flt-dep','flt-status'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    this._sortDir='none'; this.render();
  },
};

// ---- ENTRADAS ----

const PageEntradas = {
  _renderToken: 0,

  _extractRows(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    const rows = payload[key];
    return Array.isArray(rows) ? rows : [];
  },

  _extractTotalPages(payload) {
    if (!payload || typeof payload !== 'object' || !payload.meta) return 1;
    const raw = Number(payload.meta.totalPages);
    if (!Number.isFinite(raw) || raw < 1) return 1;
    return Math.floor(raw);
  },

  async _listAll(fetchPage, key) {
    const limit = 100;
    const first = await fetchPage({ page: 1, limit });
    const rows = this._extractRows(first, key);
    const totalPages = this._extractTotalPages(first);
    if (totalPages <= 1) return rows;

    const chunks = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, idx) => fetchPage({ page: idx + 2, limit }))
    );

    const all = [...rows];
    for (const payload of chunks) {
      all.push(...this._extractRows(payload, key));
    }
    return all;
  },

  _actorName(entry) {
    if (entry?.responsavel?.nome) return entry.responsavel.nome;
    if (entry?.responsavelUser?.nome) return entry.responsavelUser.nome;
    if (entry?.responsavelUserId) return `Usuario ${String(entry.responsavelUserId).slice(0, 8)}`;
    return 'Usuario';
  },

  _normalizeEntrada(raw) {
    const itemId = String(raw?.itemId || '');
    return {
      id: String(raw?.id || ''),
      itemId,
      itemCodigo: raw?.item?.codigo || '',
      itemNome: raw?.item?.descricao || (itemId ? `Item ${itemId.slice(0, 8)}` : 'Item'),
      qtd: Number(raw?.qtd || 0),
      valorUnit: Number(raw?.valorUnit || 0),
      data: raw?.data ? String(raw.data).slice(0, 10) : '',
      resp: this._actorName(raw),
      obs: raw?.obs || '',
    };
  },

  async render(filter='') {
    const token = ++this._renderToken;
    const tableEl = document.getElementById('ent-table');
    if (!tableEl) return;
    tableEl.innerHTML = Utils.emptyState('Carregando entradas...');

    try {
      const rows = await this._listAll((params) => apiClient.entradas.list(params), 'entradas');
      if (token !== this._renderToken) return;

      const f = (document.getElementById('ent-search')?.value || filter).toLowerCase();
      const list = rows
        .map((row) => this._normalizeEntrada(row))
        .filter((e) =>
          !f ||
          e.itemNome.toLowerCase().includes(f) ||
          (e.itemCodigo || '').toLowerCase().includes(f) ||
          (e.resp || '').toLowerCase().includes(f)
        );

      tableEl.innerHTML = list.length===0 ? Utils.emptyState('Nenhuma entrada registrada') : `
      <table><thead><tr><th>Cod.</th><th>Item</th><th>Qtd.</th><th>Valor Total</th><th>Data</th><th>Responsavel</th><th>Obs.</th></tr></thead>
      <tbody>${list.map(e=>`<tr>
        <td><span style="font-size:12px;font-family:var(--mono);color:var(--brand)">${e.itemCodigo||'-'}</span></td>
        <td><div class="tbl-item">${Utils.itemIcon()}<div class="tbl-name">${e.itemNome}</div></div></td>
        <td><span class="qty qty-in">+${e.qtd}</span></td>
        <td><span style="font-size:12.5px;font-family:var(--mono)">R$ ${((e.valorUnit||0)*e.qtd).toFixed(2)}</span></td>
        <td><span style="font-size:12.5px">${Utils.fmtDate(e.data)}</span></td>
        <td><span style="font-size:12.5px">${e.resp||'-'}</span></td>
        <td><span style="font-size:12.5px;color:var(--text-3)">${e.obs||'-'}</span></td>
      </tr>`).join('')}</tbody></table>`;
    } catch (err) {
      if (token !== this._renderToken) return;
      tableEl.innerHTML = Utils.emptyState('Falha ao carregar entradas');
      const msg = (err && err.message) || 'Falha ao carregar entradas.';
      Utils.notify(msg, 'error');
    }
  }
};

// ---- SAÃDAS ----
const PageSaidas = {
  _renderToken: 0,

  _extractRows(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    const rows = payload[key];
    return Array.isArray(rows) ? rows : [];
  },

  _extractTotalPages(payload) {
    if (!payload || typeof payload !== 'object' || !payload.meta) return 1;
    const raw = Number(payload.meta.totalPages);
    if (!Number.isFinite(raw) || raw < 1) return 1;
    return Math.floor(raw);
  },

  async _listAll(fetchPage, key) {
    const limit = 100;
    const first = await fetchPage({ page: 1, limit });
    const rows = this._extractRows(first, key);
    const totalPages = this._extractTotalPages(first);
    if (totalPages <= 1) return rows;

    const chunks = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, idx) => fetchPage({ page: idx + 2, limit }))
    );

    const all = [...rows];
    for (const payload of chunks) {
      all.push(...this._extractRows(payload, key));
    }
    return all;
  },

  _normalizeSaida(raw) {
    const itemId = String(raw?.itemId || '');
    const funcId = String(raw?.funcionarioId || '');
    return {
      id: String(raw?.id || ''),
      itemId,
      itemCodigo: raw?.item?.codigo || '',
      itemNome: raw?.item?.descricao || (itemId ? `Item ${itemId.slice(0, 8)}` : 'Item'),
      qtd: Number(raw?.qtd || 0),
      valorUnit: Number(raw?.valorUnit || 0),
      data: raw?.data ? String(raw.data).slice(0, 10) : '',
      funcNome:
        raw?.funcionario?.nome ||
        (funcId ? `Funcionario ${funcId.slice(0, 8)}` : 'Funcionario'),
      setor: raw?.setorSnapshotNome || '-',
      obs: raw?.obs || '',
    };
  },

  async render(filter=''){
    const token = ++this._renderToken;
    const tableEl = document.getElementById('sai-table');
    if (!tableEl) return;
    tableEl.innerHTML = Utils.emptyState('Carregando saidas...');

    try {
      const rows = await this._listAll((params) => apiClient.saidas.list(params), 'saidas');
      if (token !== this._renderToken) return;

      const f=(document.getElementById('sai-search')?.value||filter).toLowerCase();
      const list=rows
        .map((row) => this._normalizeSaida(row))
        .filter(s=>
          !f ||
          s.itemNome.toLowerCase().includes(f) ||
          (s.itemCodigo||'').toLowerCase().includes(f) ||
          (s.funcNome||'').toLowerCase().includes(f) ||
          (s.setor||'').toLowerCase().includes(f)
        );

      tableEl.innerHTML=list.length===0?Utils.emptyState('Nenhuma saida registrada'):      `
      <table><thead><tr><th>Cod.</th><th>Item</th><th>Qtd.</th><th>Valor Total</th><th>Data</th><th>Funcionario</th><th>Setor</th><th>Obs.</th></tr></thead>
      <tbody>${list.map(s=>`<tr>
        <td><span style="font-size:12px;font-family:var(--mono);color:var(--brand)">${s.itemCodigo||'-'}</span></td>
        <td><div class="tbl-item">${Utils.itemIcon()}<div class="tbl-name">${s.itemNome}</div></div></td>
        <td><span class="qty qty-out">-${s.qtd}</span></td>
        <td><span style="font-size:12.5px;font-family:var(--mono)">R$ ${((s.valorUnit||0)*s.qtd).toFixed(2)}</span></td>
        <td><span style="font-size:12.5px">${Utils.fmtDate(s.data)}</span></td>
        <td><div class="tbl-item" style="gap:8px">${Utils.avatarHtml(s.funcNome||'?','sm')}<span style="font-size:12.5px">${s.funcNome||'-'}</span></div></td>
        <td><span class="badge badge-gray">${s.setor||'-'}</span></td>
        <td><span style="font-size:12.5px;color:var(--text-3)">${s.obs||'-'}</span></td>
      </tr>`).join('')}</tbody></table>`;
    } catch (err) {
      if (token !== this._renderToken) return;
      tableEl.innerHTML = Utils.emptyState('Falha ao carregar saidas');
      const msg = (err && err.message) || 'Falha ao carregar saidas.';
      Utils.notify(msg, 'error');
    }
  }
};

// ---- CONTROLE DE ACESSO ----
const PageAcesso = {
  fetchAll(filter=''){
    const f=(document.getElementById('ac-search')?.value||filter).toLowerCase();
    return Store.getAcessos().filter(a=>!f||a.nome.toLowerCase().includes(f)||(a.cargo||'').toLowerCase().includes(f));
  },

  render(filter=''){
    const list = this.fetchAll(filter);
    document.getElementById('ac-table').innerHTML=list.length===0?Utils.emptyState('Nenhum acesso registrado'):`
      <table><thead><tr><th>Pessoa</th><th>Tipo</th><th>HorÃ¡rio</th><th>Data</th><th>Cargo</th></tr></thead>
      <tbody>${list.map(a=>`<tr>
        <td><div class="tbl-item">${Utils.avatarHtml(a.nome,'md')}<div class="tbl-name">${a.nome}</div></div></td>
        <td><span class="badge ${a.tipo==='Entrada'?'badge-green':'badge-red'} badge-dot">${a.tipo}</span></td>
        <td><span style="font-size:13px;font-weight:500;font-family:var(--mono)">${a.hora}</span></td>
        <td><span style="font-size:12.5px">${Utils.fmtDate(a.data)}</span></td>
        <td><span style="font-size:12.5px;color:var(--text-2)">${a.cargo||'â€”'}</span></td>
      </tr>`).join('')}</tbody></table>`;
  }
};

// ---- FUNCIONARIOS ----
const PageFuncionarios = {
  _renderToken: 0,
  _rows: [],

  _extractRows(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    const rows = payload[key];
    return Array.isArray(rows) ? rows : [];
  },

  _extractTotalPages(payload) {
    if (!payload || typeof payload !== 'object' || !payload.meta) return 1;
    const raw = Number(payload.meta.totalPages);
    if (!Number.isFinite(raw) || raw < 1) return 1;
    return Math.floor(raw);
  },

  async _listAll(fetchPage, key, baseParams = {}) {
    const limit = 100;
    const first = await fetchPage({ ...baseParams, page: 1, limit });
    const rows = this._extractRows(first, key);
    const totalPages = this._extractTotalPages(first);
    if (totalPages <= 1) return rows;

    const chunks = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, idx) =>
        fetchPage({ ...baseParams, page: idx + 2, limit })
      )
    );

    const all = [...rows];
    for (const payload of chunks) {
      all.push(...this._extractRows(payload, key));
    }
    return all;
  },

  _normalizeFuncionario(raw) {
    return {
      id: String(raw?.id || ''),
      nome: raw?.nome || '',
      cargo: raw?.cargo || '',
      setorId: String(raw?.setorId || raw?.setor?.id || ''),
      setor: raw?.setor?.nome || '-',
      ativo: raw?.ativo !== false,
    };
  },

  _onclickId(id) {
    return JSON.stringify(String(id));
  },

  async render(filter=''){
    const token = ++this._renderToken;
    const tableEl = document.getElementById('func-table');
    if (!tableEl) return;
    tableEl.innerHTML = Utils.emptyState('Carregando funcionarios...');

    try {
      const [funcionariosRaw, setoresRaw] = await Promise.all([
        this._listAll((params) => apiClient.funcionarios.list(params), 'funcionarios'),
        this._listAll((params) => apiClient.setores.list(params), 'setores', { ativo: true }),
      ]);
      if (token !== this._renderToken) return;

      const funcionarios = funcionariosRaw.map((row) => this._normalizeFuncionario(row));
      this._rows = funcionarios;
      const setores = setoresRaw
        .map((row) => ({ id: String(row?.id || ''), nome: row?.nome || '' }))
        .filter((row) => row.id && row.nome);

      const f=(document.getElementById('func-search')?.value||filter).toLowerCase();
      const sel=document.getElementById('func-setor-f');
      const setorF = sel?.value || '';
      if(sel){
        const v = sel.value;
        sel.innerHTML =
          '<option value="">Todos os setores</option>' +
          setores.map((s) => `<option value="${s.id}"${s.id===v?' selected':''}>${s.nome}</option>`).join('');
      }

      const list = funcionarios.filter((fn) =>
        (!f || fn.nome.toLowerCase().includes(f) || (fn.cargo || '').toLowerCase().includes(f)) &&
        (!setorF || fn.setorId === setorF)
      );

      const canEdit = Auth.isAdmin();
      tableEl.innerHTML=list.length===0?Utils.emptyState('Nenhum funcionario cadastrado'):`
      <table><thead><tr><th>Funcionario</th><th>Setor</th><th>Cargo</th><th>Status</th>${canEdit?'<th>Acoes</th>':''}</tr></thead>
      <tbody>${list.map(fn=>{
        const idArg = this._onclickId(fn.id);
        return `<tr>
        <td><div class="tbl-item">${Utils.avatarHtml(fn.nome,'md')}<div class="tbl-name">${fn.nome}</div></div></td>
        <td><span class="badge badge-blue">${fn.setor||'-'}</span></td>
        <td><span style="font-size:12.5px;color:var(--text-2)">${fn.cargo||'-'}</span></td>
        <td><span class="badge ${fn.ativo!==false?'badge-green':'badge-red'}">${fn.ativo!==false?'Ativo':'Inativo'}</span></td>
        ${canEdit?`<td><div class="tbl-actions">
          <button class="btn-icon" title="Editar" onclick='Modals.editFuncionario(${idArg})'><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon" title="${fn.ativo!==false?'Desativar':'Ativar'}" onclick='PageFuncionarios.toggleAtivo(${idArg})'><svg viewBox="0 0 24 24">${fn.ativo!==false?'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>':'<polyline points="20 6 9 17 4 12"/>'}
          </svg></button>
          <button class="btn-icon danger" title="Desativar funcionario" onclick='PageFuncionarios.deleteFuncionario(${idArg})'><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
        </div></td>`:''}
      </tr>`;
      }).join('')}</tbody></table>`;
    } catch (err) {
      if (token !== this._renderToken) return;
      tableEl.innerHTML = Utils.emptyState('Falha ao carregar funcionarios');
      const msg = (err && err.message) || 'Falha ao carregar funcionarios.';
      Utils.notify(msg, 'error');
    }
  },

  async toggleAtivo(id){
    if(!Auth.isAdmin()){ Utils.notify('Sem permissao para alterar funcionario.','error'); return; }
    const funcionarioId = String(id || '');
    const current = this._rows.find((x) => String(x.id) === funcionarioId);
    if(!current) return;
    try {
      const resp = await apiClient.funcionarios.update(funcionarioId, { ativo: current.ativo === false });
      const updated = resp?.funcionario || null;
      await this.render();
      Utils.notify(`${updated?.nome || current.nome} ${(updated?.ativo!==false)?'ativado':'desativado'}!`);
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao atualizar funcionario.';
      Utils.notify(msg, 'error');
    }
  },

  async deleteFuncionario(id){
    if(!Auth.isAdmin()){ Utils.notify('Sem permissao para desativar funcionario.','error'); return; }
    const funcionarioId = String(id || '');
    const fn = this._rows.find((x) => String(x.id) === funcionarioId);
    if(!fn) return;
    if(!confirm(`Desativar funcionario "${fn.nome}"?`)) return;
    try {
      await apiClient.funcionarios.remove(funcionarioId);
      await this.render();
      Utils.notify('Funcionario desativado!');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao desativar funcionario.';
      Utils.notify(msg, 'error');
    }
  }
};
// ---- USUARIOS ----
const PageUsuarios = {
  _renderToken: 0,
  _rows: [],

  _extractRows(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    const rows = payload[key];
    return Array.isArray(rows) ? rows : [];
  },

  _extractTotalPages(payload) {
    if (!payload || typeof payload !== 'object' || !payload.meta) return 1;
    const raw = Number(payload.meta.totalPages);
    if (!Number.isFinite(raw) || raw < 1) return 1;
    return Math.floor(raw);
  },

  async _listAll(fetchPage, key, baseParams = {}) {
    const limit = 100;
    const first = await fetchPage({ ...baseParams, page: 1, limit });
    const rows = this._extractRows(first, key);
    const totalPages = this._extractTotalPages(first);
    if (totalPages <= 1) return rows;

    const chunks = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, idx) =>
        fetchPage({ ...baseParams, page: idx + 2, limit })
      )
    );

    const all = [...rows];
    for (const payload of chunks) {
      all.push(...this._extractRows(payload, key));
    }
    return all;
  },

  _normalizeUser(raw) {
    return {
      id: String(raw?.id || ''),
      nome: raw?.nome || '',
      email: raw?.email || '',
      role: raw?.role || 'operador',
      ativo: raw?.ativo !== false,
    };
  },

  _onclickId(id) {
    return JSON.stringify(String(id));
  },

  async render() {
    const tableEl = document.getElementById('usuarios-table');
    if (!tableEl) return;
    if (!Auth.isAdmin()) {
      tableEl.innerHTML = Utils.emptyState('Acesso restrito');
      return;
    }

    const token = ++this._renderToken;
    tableEl.innerHTML = Utils.emptyState('Carregando usuarios...');

    try {
      const usersRaw = await this._listAll((params) => apiClient.users.list(params), 'users');
      if (token !== this._renderToken) return;

      const users = usersRaw.map((row) => this._normalizeUser(row));
      this._rows = users;
      const currentId = String(Auth.currentUser?.id || '');

      tableEl.innerHTML = `
      <table><thead><tr><th>Usuario</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Acoes</th></tr></thead>
      <tbody>${users.map((u) => {
        const idArg = this._onclickId(u.id);
        const canEdit = String(u.id) !== currentId;
        return `<tr>
        <td><div class="tbl-item">${Utils.avatarHtml(u.nome,'md')}<div class="tbl-name">${u.nome}</div></div></td>
        <td><span style="font-size:12.5px;font-family:var(--mono)">${u.email}</span></td>
        <td><span class="badge ${u.role==='admin'?'badge-blue':u.role==='gerente'?'badge-orange':'badge-gray'}">${ROLE_LABELS[u.role]||u.role}</span></td>
        <td><span class="badge ${u.ativo!==false?'badge-green':'badge-red'}">${u.ativo!==false?'Ativo':'Inativo'}</span></td>
        <td><div class="tbl-actions">
          <button class="btn-icon" title="Editar" onclick='Modals.editUsuario(${idArg})'><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          ${canEdit?`
            <button class="btn-icon" title="${u.ativo!==false?'Desativar':'Ativar'}" onclick='PageUsuarios.toggleAtivo(${idArg})'><svg viewBox="0 0 24 24">${u.ativo!==false?'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>':'<polyline points="20 6 9 17 4 12"/>'}
            </svg></button>
            <button class="btn-icon danger" title="Desativar usuario" onclick='PageUsuarios.deleteUser(${idArg})'><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
          `:'<span style="font-size:11px;color:var(--text-3)">Voce</span>'}
        </div></td>
      </tr>`;
      }).join('')}</tbody></table>`;
    } catch (err) {
      if (token !== this._renderToken) return;
      tableEl.innerHTML = Utils.emptyState('Falha ao carregar usuarios');
      const msg = (err && err.message) || 'Falha ao carregar usuarios.';
      Utils.notify(msg, 'error');
    }
  },

  async toggleAtivo(id) {
    if (!Auth.isAdmin()) {
      Utils.notify('Sem permissao para alterar usuario.', 'error');
      return;
    }
    const userId = String(id || '');
    const user = this._rows.find((row) => String(row.id) === userId);
    if (!user) return;
    try {
      const resp = await apiClient.users.update(userId, { ativo: user.ativo === false });
      const updated = resp?.user || null;
      await this.render();
      Utils.notify(`Usuario ${(updated?.nome || user.nome)} ${(updated?.ativo!==false)?'ativado':'desativado'}!`);
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao atualizar usuario.';
      Utils.notify(msg, 'error');
    }
  },

  async deleteUser(id) {
    if (!Auth.isAdmin()) {
      Utils.notify('Sem permissao para desativar usuario.', 'error');
      return;
    }
    const userId = String(id || '');
    const user = this._rows.find((row) => String(row.id) === userId);
    if (!user) return;
    if (!confirm(`Desativar usuario "${user.nome}"?`)) return;
    try {
      await apiClient.users.remove(userId);
      await this.render();
      Utils.notify('Usuario desativado!');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao desativar usuario.';
      Utils.notify(msg, 'error');
    }
  }
};

// ---- RELATORIOS ----
const PageRelatorios = {
  _periodo: 30,
  _renderToken: 0,
  _cache: { items: [], entradas: [], saidas: [] },

  _extractRows(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    const rows = payload[key];
    return Array.isArray(rows) ? rows : [];
  },

  _extractTotalPages(payload) {
    if (!payload || typeof payload !== 'object' || !payload.meta) return 1;
    const raw = Number(payload.meta.totalPages);
    if (!Number.isFinite(raw) || raw < 1) return 1;
    return Math.floor(raw);
  },

  async _listAll(fetchPage, key, baseParams = {}) {
    const limit = 100;
    const first = await fetchPage({ ...baseParams, page: 1, limit });
    const rows = this._extractRows(first, key);
    const totalPages = this._extractTotalPages(first);
    if (totalPages <= 1) return rows;

    const chunks = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, idx) =>
        fetchPage({ ...baseParams, page: idx + 2, limit })
      )
    );

    const all = [...rows];
    for (const payload of chunks) {
      all.push(...this._extractRows(payload, key));
    }
    return all;
  },

  _normalizeItem(raw) {
    return {
      id: String(raw?.id || ''),
      codigo: raw?.codigo || '',
      descricao: raw?.descricao || '',
      categoria: raw?.categoria?.nome || '',
      deposito: raw?.deposito?.nome || '',
      quantidade: Number(raw?.quantidade || 0),
      minimo: Number(raw?.minimo || 0),
      valor: Number(raw?.valorAtual || 0),
      obs: raw?.obs || '',
      ativo: raw?.ativo !== false,
    };
  },

  _normalizeEntrada(raw) {
    const itemId = String(raw?.itemId || '');
    return {
      id: String(raw?.id || ''),
      itemId,
      itemCodigo: raw?.item?.codigo || '',
      itemNome: raw?.item?.descricao || (itemId ? `Item ${itemId.slice(0, 8)}` : 'Item'),
      qtd: Number(raw?.qtd || 0),
      valorUnit: Number(raw?.valorUnit || 0),
      data: raw?.data ? String(raw.data).slice(0, 10) : '',
      resp: raw?.responsavelUser?.nome || raw?.responsavel?.nome || 'Usuario',
      obs: raw?.obs || '',
    };
  },

  _normalizeSaida(raw) {
    const itemId = String(raw?.itemId || '');
    const funcionarioId = String(raw?.funcionarioId || '');
    return {
      id: String(raw?.id || ''),
      itemId,
      itemCodigo: raw?.item?.codigo || '',
      itemNome: raw?.item?.descricao || (itemId ? `Item ${itemId.slice(0, 8)}` : 'Item'),
      qtd: Number(raw?.qtd || 0),
      valorUnit: Number(raw?.valorUnit || 0),
      data: raw?.data ? String(raw.data).slice(0, 10) : '',
      funcNome:
        raw?.funcionario?.nome ||
        (funcionarioId ? `Funcionario ${funcionarioId.slice(0, 8)}` : 'Funcionario'),
      setor: raw?.setorSnapshotNome || '-',
      obs: raw?.obs || '',
    };
  },

  async _loadData() {
    const [itemsRaw, entradasRaw, saidasRaw] = await Promise.all([
      this._listAll((params) => apiClient.items.list(params), 'items', { ativo: true }),
      this._listAll((params) => apiClient.entradas.list(params), 'entradas'),
      this._listAll((params) => apiClient.saidas.list(params), 'saidas'),
    ]);

    return {
      items: itemsRaw.map((row) => this._normalizeItem(row)).filter((row) => row.ativo !== false),
      entradas: entradasRaw.map((row) => this._normalizeEntrada(row)),
      saidas: saidasRaw.map((row) => this._normalizeSaida(row)),
    };
  },

  async getData(forceRefresh = false) {
    const hasCache =
      this._cache &&
      Array.isArray(this._cache.items) &&
      Array.isArray(this._cache.entradas) &&
      Array.isArray(this._cache.saidas);

    if (!forceRefresh && hasCache && (this._cache.items.length || this._cache.entradas.length || this._cache.saidas.length)) {
      return this._cache;
    }

    const data = await this._loadData();
    this._cache = data;
    return data;
  },

  async render() {
    const token = ++this._renderToken;
    const metricasEl = document.getElementById('rel-metricas');
    const setoresEl = document.getElementById('rel-setores');
    const histEl = document.getElementById('rel-hist');
    if (metricasEl) metricasEl.innerHTML = Utils.emptyState('Carregando relatorios...');
    if (setoresEl) setoresEl.innerHTML = Utils.emptyState('Carregando relatorios...');
    if (histEl) histEl.innerHTML = Utils.emptyState('Carregando relatorios...');

    try {
      const data = await this._loadData();
      if (token !== this._renderToken) return;
      this._cache = data;
      this._renderMetricas();
      this._renderPorSetor();
      this._renderHistorico();
    } catch (err) {
      if (token !== this._renderToken) return;
      if (metricasEl) metricasEl.innerHTML = Utils.emptyState('Falha ao carregar metricas');
      if (setoresEl) setoresEl.innerHTML = Utils.emptyState('Falha ao carregar setores');
      if (histEl) histEl.innerHTML = Utils.emptyState('Falha ao carregar historico');
      const msg = (err && err.message) || 'Falha ao carregar relatorios.';
      Utils.notify(msg, 'error');
    }
  },

  _cutoff(dias) {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return d.toISOString().split('T')[0];
  },

  _renderMetricas() {
    const { items, entradas, saidas } = this._cache;
    const p = this._periodo;
    const corte = this._cutoff(p);
    const saidasP = saidas.filter((s) => s.data && s.data >= corte);
    const entradasP = entradas.filter((e) => e.data && e.data >= corte);
    const totalQtd = items.reduce((s, i) => s + i.quantidade, 0);
    const totalValor = items.reduce((s, i) => s + i.quantidade * (i.valor || 0), 0);
    const gastoP = saidasP.reduce((s, x) => s + x.qtd * (x.valorUnit || 0), 0);
    const qtdSaidaP = saidasP.reduce((s, x) => s + x.qtd, 0);
    const qtdEntradaP = entradasP.reduce((s, x) => s + x.qtd, 0);
    const baixo = items.filter((i) => i.quantidade < i.minimo);

    const metricasEl = document.getElementById('rel-metricas');
    if (!metricasEl) return;

    metricasEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;">
          <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Valor em Estoque</div>
          <div style="font-size:22px;font-weight:700;color:var(--text)">R$ ${totalValor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:4px;">${totalQtd} unidades · ${items.length} tipos</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;">
          <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Gasto em ${p} dias</div>
          <div style="font-size:22px;font-weight:700;color:var(--red)">R$ ${gastoP.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:4px;">${qtdSaidaP} unidades retiradas · ${saidasP.length} movimentacoes</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;">
          <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Entradas em ${p} dias</div>
          <div style="font-size:22px;font-weight:700;color:var(--green)">+${qtdEntradaP} un.</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:4px;">${entradasP.length} reposicoes realizadas</div>
        </div>
      </div>
      ${baixo.length>0?`<div style="padding:12px 14px;background:var(--red-bg);border:1px solid var(--red-border);border-radius:var(--r);margin-bottom:16px;">
        <div style="font-size:12px;font-weight:600;color:var(--red);margin-bottom:6px;">⚠ ${baixo.length} item(s) abaixo do minimo:</div>
        ${baixo.map(i=>`<div style="font-size:12px;margin-top:3px;">• <strong>${i.codigo||''}</strong> ${i.descricao}: <strong>${i.quantidade}</strong> / ${i.minimo} min.</div>`).join('')}
      </div>`:''}`;
  },

  _renderPorSetor() {
    const { saidas } = this._cache;
    const p = this._periodo;
    const corte = this._cutoff(p);
    const saidasP = saidas.filter((s) => s.data && s.data >= corte);

    const setorMap = {};
    saidasP.forEach((s) => {
      const setor = s.setor || 'Nao informado';
      if (!setorMap[setor]) setorMap[setor] = { total: 0, qtd: 0, movs: [], itens: {} };
      setorMap[setor].total += s.qtd * (s.valorUnit || 0);
      setorMap[setor].qtd += s.qtd;
      setorMap[setor].movs.push(s);
      const key = s.itemNome;
      if (!setorMap[setor].itens[key]) {
        setorMap[setor].itens[key] = { qtd: 0, valor: 0, codigo: s.itemCodigo || '' };
      }
      setorMap[setor].itens[key].qtd += s.qtd;
      setorMap[setor].itens[key].valor += s.qtd * (s.valorUnit || 0);
    });

    const target = document.getElementById('rel-setores');
    if (!target) return;

    const totalGasto = Object.values(setorMap).reduce((s, x) => s + x.total, 0);
    if (Object.keys(setorMap).length === 0) {
      target.innerHTML = Utils.emptyState('Nenhuma movimentacao neste periodo');
      return;
    }

    target.innerHTML = Object.entries(setorMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([setor, data]) => {
        const setorArg = JSON.stringify(setor);
        const pct = totalGasto > 0 ? Math.round((data.total / totalGasto) * 100) : 0;
        const itensHtml = Object.entries(data.itens)
          .sort((a, b) => b[1].valor - a[1].valor)
          .map(([nome, d]) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12.5px;">
            <div><span style="font-family:var(--mono);color:var(--brand);font-size:11px;margin-right:6px;">${d.codigo}</span>${nome}</div>
            <div style="display:flex;gap:16px;text-align:right;flex-shrink:0;">
              <span style="color:var(--text-3)">${d.qtd} un.</span>
              <span style="font-weight:600;font-family:var(--mono)">R$ ${d.valor.toFixed(2)}</span>
            </div>
          </div>`)
          .join('');

        const funcMap = {};
        data.movs.forEach((m) => {
          const fn = m.funcNome || m.resp || '?';
          if (!funcMap[fn]) funcMap[fn] = { qtd: 0, valor: 0 };
          funcMap[fn].qtd += m.qtd;
          funcMap[fn].valor += m.qtd * (m.valorUnit || 0);
        });
        const funcHtml = Object.entries(funcMap)
          .sort((a, b) => b[1].valor - a[1].valor)
          .map(([nome, d]) => `
          <div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px;">
            ${Utils.avatarHtml(nome,'sm')}
            <span style="flex:1">${nome}</span>
            <span style="color:var(--text-3)">${d.qtd} un.</span>
            <span style="font-weight:600;font-family:var(--mono);min-width:80px;text-align:right">R$ ${d.valor.toFixed(2)}</span>
          </div>`)
          .join('');

        return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;margin-bottom:12px;cursor:pointer;" onclick='Impressao.setorPDF(${setorArg})'>
          <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--surface-2);">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:14px;font-weight:600">${setor}</span>
              <span class="badge badge-gray">${data.movs.length} retiradas</span>
            </div>
            <div style="text-align:right;">
              <div style="font-size:16px;font-weight:700;color:var(--red)">R$ ${data.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
              <div style="font-size:11px;color:var(--text-3)">${data.qtd} unidades · ${pct}% do total</div>
            </div>
          </div>
          <div style="height:4px;background:var(--border);"><div style="height:4px;background:var(--brand);width:${pct}%"></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">
            <div style="padding:14px 18px;border-right:1px solid var(--border);">
              <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Materiais retirados</div>
              ${itensHtml||'<span style="font-size:12px;color:var(--text-3)">Nenhum</span>'}
            </div>
            <div style="padding:14px 18px;">
              <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Funcionarios</div>
              ${funcHtml||'<span style="font-size:12px;color:var(--text-3)">Nenhum</span>'}
            </div>
          </div>
        </div>`;
      })
      .join('');
  },

  _renderHistorico() {
    const { entradas, saidas } = this._cache;
    const p = this._periodo;
    const corte = this._cutoff(p);
    const hist = [
      ...entradas.filter((e) => e.data && e.data >= corte).map((e) => ({ ...e, tipo: 'Entrada' })),
      ...saidas.filter((s) => s.data && s.data >= corte).map((s) => ({ ...s, tipo: 'Saida' })),
    ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const target = document.getElementById('rel-hist');
    if (!target) return;

    target.innerHTML = hist.length === 0 ? Utils.emptyState('Nenhuma movimentacao neste periodo') : `
      <table><thead><tr><th>Tipo</th><th>Cod.</th><th>Item</th><th>Qtd.</th><th>Valor</th><th>Data</th><th>Funcionario/Resp.</th><th>Setor</th></tr></thead>
      <tbody>${hist.map((h)=>`<tr>
        <td><span class="badge ${h.tipo==='Entrada'?'badge-green':'badge-red'} badge-dot">${h.tipo}</span></td>
        <td><span style="font-size:12px;font-family:var(--mono);color:var(--brand)">${h.itemCodigo||'—'}</span></td>
        <td>${h.itemNome}</td>
        <td><span class="qty ${h.tipo==='Entrada'?'qty-in':'qty-out'}">${h.tipo==='Entrada'?'+':'-'}${h.qtd}</span></td>
        <td><span style="font-size:12.5px;font-family:var(--mono)">R$ ${((h.valorUnit||0)*h.qtd).toFixed(2)}</span></td>
        <td><span style="font-size:12.5px">${Utils.fmtDate(h.data)}</span></td>
        <td><span style="font-size:12.5px">${h.funcNome||h.resp||'—'}</span></td>
        <td><span style="font-size:12px;color:var(--text-3)">${h.setor||'—'}</span></td>
      </tr>`).join('')}</tbody></table>`;
  },

  setPeriodo(p){
    this._periodo=p;
    document.querySelectorAll('.periodo-btn').forEach((b)=>{
      const selected = parseInt(b.dataset.p, 10) === p;
      b.style.background = selected ? 'var(--brand)' : 'var(--surface)';
      b.style.color = selected ? '#fff' : 'var(--text-2)';
    });
    this.render();
  }
};

// ---- CONFIGURACOES ----
const PageConfig = {
  _renderToken: 0,

  _extractRows(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    const rows = payload[key];
    return Array.isArray(rows) ? rows : [];
  },

  _extractTotalPages(payload) {
    if (!payload || typeof payload !== 'object' || !payload.meta) return 1;
    const raw = Number(payload.meta.totalPages);
    if (!Number.isFinite(raw) || raw < 1) return 1;
    return Math.floor(raw);
  },

  async _listAll(fetchPage, key, baseParams = {}) {
    const limit = 100;
    const first = await fetchPage({ ...baseParams, page: 1, limit });
    const rows = this._extractRows(first, key);
    const totalPages = this._extractTotalPages(first);
    if (totalPages <= 1) return rows;

    const chunks = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, idx) =>
        fetchPage({ ...baseParams, page: idx + 2, limit })
      )
    );

    const all = [...rows];
    for (const payload of chunks) {
      all.push(...this._extractRows(payload, key));
    }
    return all;
  },

  _onclickId(id) {
    return JSON.stringify(String(id));
  },

  _renderEntityList(targetId, rows, emptyText, deleteHandler) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.innerHTML = rows.length
      ? rows
          .map((row) => {
            const idArg = this._onclickId(row.id);
            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);"><span style="font-size:13px">${row.nome}</span><button class="btn btn-ghost btn-xs" onclick='PageConfig.${deleteHandler}(${idArg})'>Remover</button></div>`;
          })
          .join('')
      : `<div style="font-size:13px;color:var(--text-3);padding:10px 0">${emptyText}</div>`;
  },

  async render(){
    const token = ++this._renderToken;
    try {
      const [categorias, depositos, setores] = await Promise.all([
        this._listAll((params) => apiClient.categorias.list(params), 'categorias', { ativo: true }),
        this._listAll((params) => apiClient.depositos.list(params), 'depositos', { ativo: true }),
        this._listAll((params) => apiClient.setores.list(params), 'setores', { ativo: true }),
      ]);
      if (token !== this._renderToken) return;

      const catRows = categorias.map((x) => ({ id: String(x.id || ''), nome: x.nome || '' })).filter((x) => x.id && x.nome);
      const depRows = depositos.map((x) => ({ id: String(x.id || ''), nome: x.nome || '' })).filter((x) => x.id && x.nome);
      const setorRows = setores.map((x) => ({ id: String(x.id || ''), nome: x.nome || '' })).filter((x) => x.id && x.nome);

      this._renderEntityList('cfg-cats', catRows, 'Nenhuma categoria', 'deleteCat');
      this._renderEntityList('cfg-deps', depRows, 'Nenhum deposito', 'deleteDep');
      this._renderEntityList('cfg-setores', setorRows, 'Nenhum setor', 'deleteSetor');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao carregar configuracoes.';
      Utils.notify(msg, 'error');
    }
  },

  async addCat(){
    const input = document.getElementById('cfg-new-cat');
    const v = input?.value?.trim() || '';
    if(!v) return;
    try {
      await apiClient.categorias.create({ nome: v });
      if (input) input.value = '';
      await this.render();
      Utils.notify('Categoria adicionada!');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao adicionar categoria.';
      Utils.notify(msg, 'error');
    }
  },

  async deleteCat(id){
    const entityId = String(id || '');
    if(!entityId) return;
    if(!confirm('Remover categoria?')) return;
    try {
      await apiClient.categorias.remove(entityId);
      await this.render();
      Utils.notify('Categoria removida!');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao remover categoria.';
      Utils.notify(msg, 'error');
    }
  },

  async addDep(){
    const input = document.getElementById('cfg-new-dep');
    const v = input?.value?.trim() || '';
    if(!v) return;
    try {
      await apiClient.depositos.create({ nome: v });
      if (input) input.value = '';
      await this.render();
      Utils.notify('Deposito adicionado!');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao adicionar deposito.';
      Utils.notify(msg, 'error');
    }
  },

  async deleteDep(id){
    const entityId = String(id || '');
    if(!entityId) return;
    if(!confirm('Remover deposito?')) return;
    try {
      await apiClient.depositos.remove(entityId);
      await this.render();
      Utils.notify('Deposito removido!');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao remover deposito.';
      Utils.notify(msg, 'error');
    }
  },

  async addSetor(){
    const input = document.getElementById('cfg-new-setor');
    const v = input?.value?.trim() || '';
    if(!v) return;
    try {
      await apiClient.setores.create({ nome: v });
      if (input) input.value = '';
      await this.render();
      Utils.notify('Setor adicionado!');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao adicionar setor.';
      Utils.notify(msg, 'error');
    }
  },

  async deleteSetor(id){
    const entityId = String(id || '');
    if(!entityId) return;
    if(!confirm('Remover setor?')) return;
    try {
      await apiClient.setores.remove(entityId);
      await this.render();
      Utils.notify('Setor removido!');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao remover setor.';
      Utils.notify(msg, 'error');
    }
  },
};
// ---- IMPRESSÃƒO ----
const Impressao = {
  _janela(html){const w=window.open('','_blank','width=800,height=700');w.document.write(html);w.document.close();w.onload=()=>{w.focus();w.print();};},

  _base(title,conteudo,termica=false){
    const css=termica?`body{font-family:monospace;font-size:11px;width:280px;margin:0 auto}h2{font-size:13px;text-align:center;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:8px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{padding:3px 4px;text-align:left}th{border-bottom:1px solid #000;font-weight:bold}.right{text-align:right}.footer{text-align:center;margin-top:10px;border-top:1px dashed #000;padding-top:6px;font-size:9px}`
    :`body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:30px}h2{font-size:18px;margin-bottom:4px;color:#1A56DB}h3{font-size:14px;margin:20px 0 8px;color:#333}.sub{color:#666;font-size:11px;margin-bottom:16px}table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#1A56DB;color:#fff;padding:8px 10px;text-align:left;font-size:11px}td{padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px}tr:nth-child(even) td{background:#f7f8fa}.badge-in{color:#059669;font-weight:bold}.badge-out{color:#DC2626;font-weight:bold}.low{color:#DC2626;font-weight:bold}.assinatura{margin-top:40px;border-top:1px solid #ccc;padding-top:10px;font-size:11px;color:#666}.footer{margin-top:20px;font-size:10px;color:#999;text-align:center}@media print{button{display:none}}`;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>${css}</style></head><body>${conteudo}</body></html>`;
  },
  async _getDadosRelatorios(forceRefresh = false){
    try {
      return await PageRelatorios.getData(forceRefresh);
    } catch (_) {
      return { items: [], entradas: [], saidas: [] };
    }
  },

  async termoRetirada(saidaId){
    const dados = await this._getDadosRelatorios();
    const saida = (dados.saidas || []).find((s) => String(s.id) === String(saidaId));
    if(!saida){ Utils.notify('Saida nao encontrada','error'); return; }
    const now = new Date().toLocaleDateString('pt-BR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    const html=`
      <div style="text-align:center;margin-bottom:24px;border-bottom:2px solid #1A56DB;padding-bottom:16px;">
        <h2 style="margin-bottom:4px;">TERMO DE RETIRADA DE MATERIAL</h2>
        <div class="sub">Almox - Sistema de Gestao de Almoxarifado</div>
      </div>
      <table style="margin-bottom:20px;">
        <tr><td style="width:140px;color:#666;font-weight:600">N do Termo:</td><td><strong>#${String(saidaId).padStart(5,'0')}</strong></td><td style="width:140px;color:#666;font-weight:600">Data da retirada:</td><td>${Utils.fmtDate(saida.data)}</td></tr>
        <tr><td style="color:#666;font-weight:600">Funcionario:</td><td><strong>${saida.funcNome||saida.resp||'-'}</strong></td><td style="color:#666;font-weight:600">Setor:</td><td>${saida.setor||'-'}</td></tr>
      </table>
      <h3>Material Retirado</h3>
      <table>
        <thead><tr><th>Cod.</th><th>Descricao</th><th>Qtd.</th><th>Valor Unit.</th><th>Total</th></tr></thead>
        <tbody>
          <tr>
            <td>${saida.itemCodigo||'-'}</td>
            <td>${saida.itemNome}</td>
            <td>${saida.qtd}</td>
            <td>R$ ${(saida.valorUnit||0).toFixed(2)}</td>
            <td><strong>R$ ${((saida.valorUnit||0)*saida.qtd).toFixed(2)}</strong></td>
          </tr>
        </tbody>
      </table>
      ${saida.obs?`<p style="margin-top:12px;font-size:12px;color:#666"><strong>Observacao:</strong> ${saida.obs}</p>`:''}
      <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;">
        <div class="assinatura"><div style="margin-bottom:30px"></div><div>_______________________________</div><div style="margin-top:6px"><strong>${saida.funcNome||saida.resp||'Funcionario'}</strong></div><div style="font-size:10px;color:#999">${saida.setor||''} - Assinatura do requerente</div></div>
        <div class="assinatura"><div style="margin-bottom:30px"></div><div>_______________________________</div><div style="margin-top:6px"><strong>Responsavel pelo Almoxarifado</strong></div><div style="font-size:10px;color:#999">Assinatura e carimbo</div></div>
      </div>
      <div class="footer">Almox - Emitido em ${now} · Documento de controle interno</div>`;
    this._janela(this._base('Termo de Retirada',html,false));
  },

  async estoque(termica=false){
    const dados = await this._getDadosRelatorios(true);
    const items = dados.items || [];
    const now = new Date().toLocaleString('pt-BR');
    if(termica){
      const linhas=items.map(i=>`<tr><td>${(i.codigo||'').substring(0,8)}</td><td>${String(i.descricao||'').substring(0,16)}</td><td class="right">${i.quantidade}${i.quantidade<i.minimo?' !':''}</td></tr>`).join('');
      this._janela(this._base('Estoque',`<h2>ALMOXARIFADO<br>Estoque Atual</h2><div style="text-align:center;font-size:9px;margin-bottom:8px">${now}</div><table><tr><th>Cod</th><th>Item</th><th class="right">Qtd</th></tr>${linhas}</table><div class="footer">! = abaixo do minimo</div>`,true));
    } else {
      const totalValor=items.reduce((s,i)=>s+(i.quantidade*(i.valor||0)),0);
      const linhas=items.map(i=>`<tr><td>${i.codigo||'-'}</td><td>${i.descricao}</td><td>${i.categoria}</td><td>${i.deposito}</td><td>${i.quantidade<i.minimo?`<span class="low">${i.quantidade} !</span>`:i.quantidade}</td><td>${i.minimo}</td><td>R$ ${(i.valor||0).toFixed(2)}</td><td>R$ ${((i.valor||0)*i.quantidade).toFixed(2)}</td></tr>`).join('');
      this._janela(this._base('Estoque',`<h2>Relatorio de Estoque</h2><div class="sub">Emitido em ${now} · ${items.length} tipos · Valor total: R$ ${totalValor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><table><tr><th>Cod.</th><th>Descricao</th><th>Categoria</th><th>Deposito</th><th>Qtd.</th><th>Min.</th><th>Valor Unit.</th><th>Total</th></tr>${linhas}</table>`,false));
    }
  },

  async movimentacoes(termica=false){
    const dados = await this._getDadosRelatorios(true);
    const entradas = dados.entradas || [];
    const saidas = dados.saidas || [];
    const hist=[...entradas.map(e=>({...e,tipo:'E'})),...saidas.map(s=>({...s,tipo:'S'}))].sort((a,b)=>new Date(b.data)-new Date(a.data));
    const now=new Date().toLocaleString('pt-BR');
    if(termica){
      this._janela(this._base('Movimentacoes',`<h2>MOVIMENTACOES</h2><div style="text-align:center;font-size:9px;margin-bottom:8px">${now}</div><table><tr><th>Tp</th><th>Item</th><th class="right">Qtd</th></tr>${hist.map(h=>`<tr><td>${h.tipo}</td><td>${String(h.itemNome||'').substring(0,14)}</td><td class="right">${h.tipo==='E'?'+':'-'}${h.qtd}</td></tr>`).join('')}</table><div class="footer">${hist.length} registros</div>`,true));
    } else {
      const linhas=hist.map(h=>`<tr><td><span class="${h.tipo==='E'?'badge-in':'badge-out'}">${h.tipo==='E'?'Entrada':'Saida'}</span></td><td>${h.itemCodigo||'-'}</td><td>${h.itemNome}</td><td>${h.tipo==='E'?'+':'-'}${h.qtd}</td><td>R$ ${((h.valorUnit||0)*h.qtd).toFixed(2)}</td><td>${String(h.data||'').split('-').reverse().join('/')}</td><td>${h.funcNome||h.resp||'-'}</td><td>${h.setor||'-'}</td></tr>`).join('');
      this._janela(this._base('Movimentacoes',`<h2>Relatorio de Movimentacoes</h2><div class="sub">Emitido em ${now} · ${hist.length} registros</div><table><tr><th>Tipo</th><th>Cod.</th><th>Item</th><th>Qtd.</th><th>Valor</th><th>Data</th><th>Funcionario</th><th>Setor</th></tr>${linhas}</table>`,false));
    }
  },

  async setorPDF(setor){
    const dados = await this._getDadosRelatorios();
    const saidas=(dados.saidas || []).filter((s)=>String(s.setor||'')===String(setor||''));
    const now=new Date().toLocaleString('pt-BR');
    const total=saidas.reduce((s,x)=>s+(x.qtd*(x.valorUnit||0)),0);
    const linhas=saidas.sort((a,b)=>new Date(b.data)-new Date(a.data)).map(s=>`<tr><td>${Utils.fmtDate(s.data)}</td><td>${s.itemCodigo||'-'}</td><td>${s.itemNome}</td><td>${s.qtd}</td><td>R$ ${(s.valorUnit||0).toFixed(2)}</td><td><strong>R$ ${((s.valorUnit||0)*s.qtd).toFixed(2)}</strong></td><td>${s.funcNome||s.resp||'-'}</td></tr>`).join('');
    this._janela(this._base(`Relatorio ${setor}`,`<h2>Relatorio por Setor: ${setor}</h2><div class="sub">Emitido em ${now} · ${saidas.length} retiradas · Total: R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><table><tr><th>Data</th><th>Cod.</th><th>Item</th><th>Qtd.</th><th>Unit.</th><th>Total</th><th>Funcionario</th></tr>${linhas}</table>`,false));
  },

  acessos(termica=false){
    const lista=Store.getAcessos(),now=new Date().toLocaleString('pt-BR');
    if(termica){
      this._janela(this._base('Acesso',`<h2>CONTROLE DE ACESSO</h2><table><tr><th>Nome</th><th>T</th><th>Hora</th></tr>${lista.map(a=>`<tr><td>${a.nome.substring(0,14)}</td><td>${a.tipo==='Entrada'?'E':'S'}</td><td>${a.hora}</td></tr>`).join('')}</table>`,true));
    } else {
      this._janela(this._base('Acesso',`<h2>Controle de Acesso</h2><div class="sub">${now}</div><table><tr><th>Nome</th><th>Tipo</th><th>Hora</th><th>Data</th><th>Cargo</th></tr>${lista.map(a=>`<tr><td>${a.nome}</td><td><span class="${a.tipo==='Entrada'?'badge-in':'badge-out'}">${a.tipo}</span></td><td>${a.hora}</td><td>${Utils.fmtDate(a.data)}</td><td>${a.cargo||'â€”'}</td></tr>`).join('')}</table>`,false));
    }
  }
};
