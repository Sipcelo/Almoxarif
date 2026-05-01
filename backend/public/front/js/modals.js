/* ============================================================
   Almox — Modals v4
   ============================================================ */

const Modals = {  // ---- ITEM ----
  _itemCatalog: { categorias: [], depositos: [], items: [] },
  _itemDepositoTouched: false,
  _entradaItems: [],
  _saidaItems: [],
  _saidaFuncionarios: [],
  _funcSetores: [],

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

  _normalizeName(v) {
    return String(v || '').trim().toLowerCase();
  },

  _normalizeSearch(v) {
    return String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  },

  _escapeHtml(v) {
    return String(v || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  },

  _findByName(rows, nome) {
    const key = this._normalizeName(nome);
    return rows.find((r) => this._normalizeName(r.nome) === key) || null;
  },

  _normalizeItem(raw) {
    if (!raw) return null;
    return {
      id: String(raw.id || ''),
      codigo: raw.codigo || '',
      descricao: raw.descricao || '',
      categoriaId: raw.categoriaId || raw?.categoria?.id || '',
      categoria: raw?.categoria?.nome || '',
      depositoId: raw.depositoId || raw?.deposito?.id || '',
      deposito: raw?.deposito?.nome || '',
      quantidade: Number(raw.quantidade || 0),
      minimo: Number(raw.minimo || 0),
      valor: Number(raw.valorAtual || 0),
      obs: raw.obs || '',
      ativo: raw.ativo !== false,
    };
  },

  _normalizeItemForEntrada(raw) {
    if (!raw) return null;
    return {
      id: String(raw.id || ''),
      codigo: raw.codigo || '',
      descricao: raw.descricao || '',
      quantidade: Number(raw.quantidade || 0),
      minimo: Number(raw.minimo || 0),
      valorAtual: Number(raw.valorAtual || 0),
      ativo: raw.ativo !== false,
    };
  },

  _normalizeFuncionarioForSaida(raw) {
    if (!raw) return null;
    return {
      id: String(raw.id || ''),
      nome: raw.nome || '',
      cargo: raw.cargo || '',
      setor: raw?.setor?.nome || '',
      ativo: raw.ativo !== false,
    };
  },

  _toIsoDate(dateStr) {
    const value = String(dateStr || '').trim();
    if (!value) return null;
    const parsed = new Date(`${value}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  },

  _suggestDepositoForCategoria(categoriaNome) {
    const key = this._normalizeSearch(categoriaNome);
    const rules = [
      { terms: ['limpeza', 'higiene'], code: 'dep-003' },
      { terms: ['informatica'], code: 'dep-004' },
      { terms: ['expediente'], code: 'dep-005' },
      { terms: ['copa', 'cozinha'], code: 'dep-006' },
      { terms: ['manutencao'], code: 'dep-007' },
      { terms: ['epi', 'seguranca'], code: 'dep-008' },
      { terms: ['recepcao', 'operacional', 'embalagem', 'armazenagem', 'utensilios', 'gerais'], code: 'dep-001' },
    ];
    const match = rules.find((rule) => rule.terms.some((term) => key.includes(term)));
    if (!match) return null;
    return this._itemCatalog.depositos.find((d) => this._normalizeSearch(d.nome).includes(match.code)) || null;
  },

  _renderItemCategoryContext(categoriaNome) {
    const el = document.getElementById('m-item-category-context');
    if (!el) return;
    const categoria = this._findByName(this._itemCatalog.categorias, categoriaNome);
    if (!categoriaNome || !categoria) {
      el.textContent = 'Selecione uma categoria para ver os itens relacionados.';
      return;
    }
    const rows = this._itemCatalog.items
      .map((row) => this._normalizeItem(row))
      .filter((row) => row && row.ativo !== false)
      .filter((row) => row.categoriaId === categoria.id || this._normalizeName(row.categoria) === this._normalizeName(categoria.nome))
      .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
      .slice(0, 30);

    if (!rows.length) {
      el.textContent = 'Nenhum item cadastrado nesta categoria.';
      return;
    }

    el.innerHTML = rows.map((row) => `
      <div class="item-context-row">
        <span class="item-context-code">${this._escapeHtml(row.codigo || '-')}</span>
        <span class="item-context-name" title="${this._escapeHtml(row.descricao)}">${this._escapeHtml(row.descricao)}</span>
        <span class="item-context-stock">${this._escapeHtml(row.deposito || '')} · ${row.quantidade} un.</span>
      </div>
    `).join('');
  },

  updateItemCategoryContext(options = {}) {
    const catEl = document.getElementById('m-item-cat');
    const depEl = document.getElementById('m-item-dep');
    const hintEl = document.getElementById('m-item-dep-hint');
    if (!catEl || !depEl) return;

    const suggested = this._suggestDepositoForCategoria(catEl.value);
    if (suggested && (!this._itemDepositoTouched || options.forceSuggestion)) {
      depEl.value = suggested.nome;
    }

    if (hintEl) {
      hintEl.textContent = suggested
        ? `Sugestão para esta categoria: ${suggested.nome}`
        : '';
    }
    this._renderItemCategoryContext(catEl.value);
  },

  markItemDepositoTouched() {
    this._itemDepositoTouched = true;
  },

  async _loadItemCatalog() {
    const [categorias, depositos, items] = await Promise.all([
      this._listAll((params) => apiClient.categorias.list(params), 'categorias'),
      this._listAll((params) => apiClient.depositos.list(params), 'depositos'),
      this._listAll((params) => apiClient.items.list(params), 'items'),
    ]);
    this._itemCatalog = { categorias, depositos, items };
    return this._itemCatalog;
  },

  async openNewItem(){
    try {
      const { categorias, depositos } = await this._loadItemCatalog();
      if (!categorias.length || !depositos.length) {
        Utils.notify('Cadastre categoria e deposito antes de criar item.', 'error');
        return;
      }
      Utils.fillSelect('m-item-cat', categorias.map((c) => c.nome));
      Utils.fillSelect('m-item-dep', depositos.map((d) => d.nome));
      this._itemDepositoTouched = false;
      ['m-item-id','m-item-desc','m-item-codigo','m-item-obs'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
      document.getElementById('m-item-qtd').value='0';
      document.getElementById('m-item-qtd').disabled=false;
      document.getElementById('m-item-min').value='5';
      document.getElementById('m-item-valor').value='0.00';
      document.getElementById('m-item-title').textContent='Novo Item';
      this.updateItemCategoryContext({ forceSuggestion: true });
      Utils.openModal('modal-item');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao abrir modal de item.';
      Utils.notify(msg, 'error');
    }
  },

  async editItem(id){
    try {
      const [catalog, res] = await Promise.all([
        this._loadItemCatalog(),
        apiClient.items.get(String(id)),
      ]);
      const item = this._normalizeItem(res?.item);
      if(!item)return;
      Utils.fillSelect('m-item-cat', catalog.categorias.map((c) => c.nome));
      Utils.fillSelect('m-item-dep', catalog.depositos.map((d) => d.nome));
      const categoria = catalog.categorias.find((c) => c.id === item.categoriaId);
      const deposito = catalog.depositos.find((d) => d.id === item.depositoId);
      document.getElementById('m-item-id').value      = item.id;
      document.getElementById('m-item-codigo').value  = item.codigo||'';
      document.getElementById('m-item-desc').value    = item.descricao;
      document.getElementById('m-item-cat').value     = (categoria && categoria.nome) || item.categoria || '';
      document.getElementById('m-item-dep').value     = (deposito && deposito.nome) || item.deposito || '';
      document.getElementById('m-item-qtd').value     = item.quantidade;
      document.getElementById('m-item-qtd').disabled  = true;
      document.getElementById('m-item-min').value     = item.minimo;
      document.getElementById('m-item-valor').value   = (item.valor||0).toFixed(2);
      document.getElementById('m-item-obs').value     = item.obs||'';
      document.getElementById('m-item-title').textContent='Editar Item';
      this._itemDepositoTouched = true;
      this.updateItemCategoryContext();
      Utils.openModal('modal-item');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao carregar item.';
      Utils.notify(msg, 'error');
    }
  },

  async saveItem(){
    const id    = String(document.getElementById('m-item-id').value || '').trim();
    const desc  = document.getElementById('m-item-desc').value.trim();
    const codigo= document.getElementById('m-item-codigo').value.trim().toUpperCase();
    if(!desc){ Utils.notify('Preencha a descricao','error'); return; }

    try {
      if (!this._itemCatalog.categorias.length || !this._itemCatalog.depositos.length) {
        await this._loadItemCatalog();
      }
      const categoriaNome = document.getElementById('m-item-cat').value;
      const depositoNome = document.getElementById('m-item-dep').value;
      const categoria = this._findByName(this._itemCatalog.categorias, categoriaNome);
      const deposito = this._findByName(this._itemCatalog.depositos, depositoNome);
      if (!categoria || !deposito) {
        Utils.notify('Categoria ou deposito invalido.', 'error');
        return;
      }

      const payload = {
        codigo,
        descricao: desc,
        categoriaId: categoria.id,
        depositoId: deposito.id,
        minimo: parseInt(document.getElementById('m-item-min').value)||5,
        valorAtual: parseFloat(document.getElementById('m-item-valor').value)||0,
        obs: document.getElementById('m-item-obs').value.trim() || null,
      };

      let item = null;
      if(id){
        const res = await apiClient.items.update(id, payload);
        item = res?.item || null;
      } else {
        const res = await apiClient.items.create({
          ...payload,
          quantidade: parseInt(document.getElementById('m-item-qtd').value)||0,
        });
        item = res?.item || null;
      }

      Utils.closeModal('modal-item');
      App.refreshCurrentPage();
      App.addActivity(`<strong>${Auth.currentUser?.nome||'Admin'}</strong>: ${id?'Editou':'Criou'} item "${item?.descricao||desc}"`, id?'blue':'green');
      Utils.notify(id?'Item atualizado!':'Item criado!');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao salvar item.';
      Utils.notify(msg, 'error');
    }
  },

  async deleteItem(id){
    const itemId = String(id || '').trim();
    if(!itemId)return;
    if(!confirm('Excluir este item?'))return;
    try {
      await apiClient.items.remove(itemId);
      App.refreshCurrentPage();
      Utils.notify('Item excluido!');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao excluir item.';
      Utils.notify(msg, 'error');
    }
  },

  // ---- ENTRADA ----

  async openEntrada(preselectedItemId = ''){
    try {
      const rows = await this._listAll((params) => apiClient.items.list(params), 'items');
      const items = rows
        .map((row) => this._normalizeItemForEntrada(row))
        .filter((row) => row && row.ativo !== false);

      this._entradaItems = items;
      Utils.fillItemSelect('m-ent-item', items);
      if (preselectedItemId) {
        document.getElementById('m-ent-item').value = String(preselectedItemId);
      }
      document.getElementById('m-ent-qtd').value = '1';
      document.getElementById('m-ent-data').value = Utils.today();
      document.getElementById('m-ent-resp').value = Auth.currentUser?.nome || '';
      document.getElementById('m-ent-obs').value = '';
      Utils.openModal('modal-entrada');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao abrir entrada.';
      Utils.notify(msg, 'error');
    }
  },

  openEntradaFor(itemId){ this.openEntrada(String(itemId || '')); },

  async saveEntrada(){
    const itemId = String(document.getElementById('m-ent-item').value || '').trim();
    const qtd = parseInt(document.getElementById('m-ent-qtd').value, 10);
    if(!itemId){ Utils.notify('Selecione um item','error'); return; }
    if(!Number.isFinite(qtd) || qtd < 1){ Utils.notify('Quantidade invalida','error'); return; }

    let item = this._entradaItems.find((row) => String(row.id) === itemId) || null;
    if (!item) {
      try {
        const one = await apiClient.items.get(itemId);
        item = this._normalizeItemForEntrada(one?.item);
      } catch (_) {
        item = null;
      }
    }
    if(!item){ Utils.notify('Item nao encontrado','error'); return; }

    try {
      const payload = {
        itemId,
        qtd,
        valorUnit: Number(item.valorAtual || 0),
        obs: document.getElementById('m-ent-obs').value.trim() || null,
      };
      const isoDate = this._toIsoDate(document.getElementById('m-ent-data').value);
      if (isoDate) payload.data = isoDate;

      const created = await apiClient.entradas.create(payload);
      const actorName = document.getElementById('m-ent-resp').value.trim() || Auth.currentUser?.nome || 'Usuario';
      const itemNome = item.descricao || created?.entrada?.item?.descricao || 'item';

      App.addActivity(`<strong>${actorName}</strong>: Entrada de ${itemNome} (+${qtd})`,'green');
      Utils.closeModal('modal-entrada');
      App.refreshCurrentPage();
      Utils.notify(`Entrada de ${qtd} unidade(s) registrada!`);
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao registrar entrada.';
      Utils.notify(msg, 'error');
    }
  },

// ---- SAIDA ----
  async openSaida(preselectedItemId = ''){
    try {
      const [itemsRaw, funcsRaw] = await Promise.all([
        this._listAll((params) => apiClient.items.list(params), 'items'),
        this._listAll((params) => apiClient.funcionarios.list(params), 'funcionarios'),
      ]);

      const items = itemsRaw
        .map((row) => this._normalizeItemForEntrada(row))
        .filter((row) => row && row.ativo !== false);
      const funcs = funcsRaw
        .map((row) => this._normalizeFuncionarioForSaida(row))
        .filter((row) => row && row.ativo !== false);

      this._saidaItems = items;
      this._saidaFuncionarios = funcs;

      Utils.fillItemSelect('m-sai-item', items);
      this._setupFuncSearch();
      document.getElementById('m-sai-qtd').value = '1';
      document.getElementById('m-sai-data').value = Utils.today();
      document.getElementById('m-sai-obs').value = '';
      document.getElementById('m-sai-info').textContent = '';
      if (preselectedItemId) {
        document.getElementById('m-sai-item').value = String(preselectedItemId);
      }
      this.updateSaidaMax();
      Utils.openModal('modal-saida');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao abrir saida.';
      Utils.notify(msg, 'error');
    }
  },

  openSaidaFor(itemId){ this.openSaida(String(itemId || '')); },

  _setupFuncSearch(){
    const input  = document.getElementById('m-sai-func-search');
    const results= document.getElementById('m-sai-func-results');
    const hiddenId   = document.getElementById('m-sai-func-id');
    const hiddenNome = document.getElementById('m-sai-func-nome');
    const hiddenSetor= document.getElementById('m-sai-func-setor');
    const tag        = document.getElementById('m-sai-func-tag');
    if(!input) return;

    input.value=''; hiddenId.value=''; hiddenNome.value=''; hiddenSetor.value='';
    tag.style.display='none'; results.style.display='none'; results.innerHTML='';

    input.oninput = ()=>{
      const q=input.value.toLowerCase().trim();
      if(!q){ results.style.display='none'; return; }
      const fns=this._saidaFuncionarios.filter(f=>
        (f.nome||'').toLowerCase().includes(q) ||
        (f.setor||'').toLowerCase().includes(q) ||
        (f.cargo||'').toLowerCase().includes(q)
      );
      if(fns.length===0){
        results.innerHTML='<div style="padding:10px 14px;font-size:13px;color:var(--text-3)">Nenhum funcionario encontrado</div>';
        results.style.display='block';
        return;
      }
      results.innerHTML=fns.map(f=>{
        const idArg = JSON.stringify(String(f.id));
        return `
        <div onclick='Modals._selectFunc(${idArg})' style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);transition:background .15s;" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
          ${Utils.avatarHtml(f.nome,'sm')}
          <div><div style="font-size:13px;font-weight:500">${f.nome}</div><div style="font-size:11.5px;color:var(--text-3)">${f.setor||'-'} - ${f.cargo||'-'}</div></div>
        </div>`;
      }).join('');
      results.style.display='block';
    };

    setTimeout(()=>{
      document.addEventListener('click', function handler(e){
        if(!results.contains(e.target)&&e.target!==input){ results.style.display='none'; document.removeEventListener('click',handler); }
      });
    },100);
  },

  _selectFunc(id){
    const funcId = String(id || '');
    const fn=this._saidaFuncionarios.find(f=>String(f.id)===funcId); if(!fn)return;
    document.getElementById('m-sai-func-id').value   = fn.id;
    document.getElementById('m-sai-func-nome').value = fn.nome;
    document.getElementById('m-sai-func-setor').value= fn.setor || '';
    document.getElementById('m-sai-func-search').value='';
    document.getElementById('m-sai-func-results').style.display='none';
    const tag=document.getElementById('m-sai-func-tag');
    tag.innerHTML=`${Utils.avatarHtml(fn.nome,'sm')} <div><div style="font-size:13px;font-weight:500">${fn.nome}</div><div style="font-size:11px;color:var(--text-3)">${fn.setor||'-'} - ${fn.cargo||'-'}</div></div><button onclick="Modals._clearFunc()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--text-3);font-size:16px;padding:0 4px;">x</button>`;
    tag.style.display='flex';
  },

  _clearFunc(){
    document.getElementById('m-sai-func-id').value   ='';
    document.getElementById('m-sai-func-nome').value ='';
    document.getElementById('m-sai-func-setor').value='';
    document.getElementById('m-sai-func-tag').style.display='none';
    document.getElementById('m-sai-func-search').value='';
    document.getElementById('m-sai-func-search').focus();
  },

  updateSaidaMax(){
    const itemId=String(document.getElementById('m-sai-item').value || '');
    const item=this._saidaItems.find(i=>String(i.id)===itemId);
    const info=document.getElementById('m-sai-info');
    if(item){
      document.getElementById('m-sai-qtd').max=item.quantidade;
      if(info)info.textContent=`Disponivel: ${item.quantidade} un. - R$ ${(item.valorAtual||0).toFixed(2)} unit.`;
    } else if(info){
      info.textContent='';
    }
  },

  async saveSaida(){
    const itemId = String(document.getElementById('m-sai-item').value || '').trim();
    const qtd = parseInt(document.getElementById('m-sai-qtd').value, 10);
    const funcId = String(document.getElementById('m-sai-func-id').value || '').trim();
    const funcNome=document.getElementById('m-sai-func-nome').value.trim();
    const funcSetor=document.getElementById('m-sai-func-setor').value.trim();

    if(!itemId) { Utils.notify('Selecione um item','error'); return; }
    if(!Number.isFinite(qtd) || qtd < 1) { Utils.notify('Quantidade invalida','error'); return; }
    if(!funcId) { Utils.notify('Selecione o funcionario','error'); return; }

    let item=this._saidaItems.find(i=>String(i.id)===itemId) || null;
    if(!item){
      try {
        const one = await apiClient.items.get(itemId);
        item = this._normalizeItemForEntrada(one?.item);
      } catch (_) {
        item = null;
      }
    }
    if(!item){ Utils.notify('Item nao encontrado','error'); return; }

    if(item.quantidade < qtd){
      Utils.notify('Saldo insuficiente para realizar saida','error');
      return;
    }

    try {
      const payload = {
        itemId,
        qtd,
        valorUnit: Number(item.valorAtual || 0),
        funcionarioId: funcId,
        obs: document.getElementById('m-sai-obs').value.trim() || null,
      };
      const isoDate = this._toIsoDate(document.getElementById('m-sai-data').value);
      if (isoDate) payload.data = isoDate;

      const created = await apiClient.saidas.create(payload);
      const outItemName = item.descricao || created?.saida?.item?.descricao || 'item';
      const outFuncName = funcNome || created?.saida?.funcionario?.nome || 'Funcionario';
      const outSetor = funcSetor || created?.saida?.setorSnapshotNome || '';

      App.addActivity(`<strong>${outFuncName}</strong>: Retirada de ${outItemName} (-${qtd})${outSetor ? ` - ${outSetor}` : ''}`,'red');
      Utils.closeModal('modal-saida');
      App.refreshCurrentPage();

      let itemAfter = null;
      try {
        const after = await apiClient.items.get(itemId);
        itemAfter = this._normalizeItemForEntrada(after?.item);
      } catch (_) {
        itemAfter = null;
      }

      if(itemAfter && itemAfter.quantidade < itemAfter.minimo) {
        Utils.notify(`Item ${outItemName} abaixo do minimo!`,'error');
      } else {
        Utils.notify('Saida registrada!');
      }
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao registrar saida.';
      Utils.notify(msg, 'error');
    }
  },
  // ---- FUNCIONARIO ----
  _normalizeSetorForFuncionario(raw) {
    if (!raw) return null;
    return {
      id: String(raw.id || ''),
      nome: raw.nome || '',
      ativo: raw.ativo !== false,
    };
  },

  _fillFuncionarioSetorSelect(setores, selectedId = '') {
    const sel = document.getElementById('m-func-setor');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione um setor...</option>' +
      setores
        .map((s) => `<option value="${s.id}"${String(s.id)===String(selectedId)?' selected':''}>${s.nome}${s.ativo===false?' (inativo)':''}</option>`)
        .join('');
    if (selectedId) sel.value = String(selectedId);
  },

  async _loadFuncionarioSetores(extraSetor = null) {
    const rows = await this._listAll((params) => apiClient.setores.list(params), 'setores');
    const setores = rows
      .map((row) => this._normalizeSetorForFuncionario(row))
      .filter((row) => row && row.id && row.nome && row.ativo !== false);

    const extra = this._normalizeSetorForFuncionario(extraSetor);
    if (extra && extra.id && !setores.some((s) => s.id === extra.id)) {
      setores.push(extra);
    }

    this._funcSetores = setores;
    return setores;
  },

  async openNewFuncionario(){
    try {
      const setores = await this._loadFuncionarioSetores();
      if (!setores.length) {
        Utils.notify('Cadastre um setor ativo antes de criar funcionario.', 'error');
        return;
      }
      document.getElementById('m-func-id').value = '';
      document.getElementById('m-func-nome').value = '';
      document.getElementById('m-func-cargo').value = '';
      document.getElementById('m-func-ativo').checked = true;
      document.getElementById('m-func-title').textContent = 'Novo Funcionario';
      this._fillFuncionarioSetorSelect(setores);
      Utils.openModal('modal-funcionario');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao abrir modal de funcionario.';
      Utils.notify(msg, 'error');
    }
  },

  async editFuncionario(id){
    const funcionarioId = String(id || '').trim();
    if (!funcionarioId) return;
    try {
      const resp = await apiClient.funcionarios.get(funcionarioId);
      const fn = resp?.funcionario || null;
      if (!fn) return;

      const setores = await this._loadFuncionarioSetores(fn?.setor || null);
      document.getElementById('m-func-id').value = String(fn.id || '');
      document.getElementById('m-func-nome').value = fn.nome || '';
      document.getElementById('m-func-cargo').value = fn.cargo || '';
      document.getElementById('m-func-ativo').checked = fn.ativo !== false;
      document.getElementById('m-func-title').textContent = 'Editar Funcionario';
      this._fillFuncionarioSetorSelect(setores, String(fn.setorId || fn?.setor?.id || ''));
      Utils.openModal('modal-funcionario');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao carregar funcionario.';
      Utils.notify(msg, 'error');
    }
  },

  async saveFuncionario(){
    const id = String(document.getElementById('m-func-id').value || '').trim();
    const nome = document.getElementById('m-func-nome').value.trim();
    const setorId = String(document.getElementById('m-func-setor').value || '').trim();
    const cargo = document.getElementById('m-func-cargo').value.trim();
    const ativo = document.getElementById('m-func-ativo').checked;

    if (!nome || nome.length < 2) { Utils.notify('Informe o nome do funcionario.', 'error'); return; }
    if (!cargo || cargo.length < 2) { Utils.notify('Informe cargo com pelo menos 2 caracteres.', 'error'); return; }
    if (!setorId) { Utils.notify('Selecione um setor.', 'error'); return; }

    try {
      if (id) {
        await apiClient.funcionarios.update(id, { nome, cargo, setorId, ativo });
      } else {
        await apiClient.funcionarios.create({ nome, cargo, setorId });
      }
      Utils.closeModal('modal-funcionario');
      if (App.currentPage === 'funcionarios') {
        await PageFuncionarios.render();
      } else {
        App.refreshCurrentPage();
      }
      Utils.notify(id ? 'Funcionario atualizado!' : 'Funcionario cadastrado!');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao salvar funcionario.';
      Utils.notify(msg, 'error');
    }
  },
  // ---- USUARIO ----
  openNewUsuario(){
    ['m-usr-id','m-usr-nome','m-usr-email','m-usr-senha'].forEach((id)=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('m-usr-role').value='operador';
    document.getElementById('m-usr-ativo').checked=true;
    document.getElementById('m-usr-title').textContent='Novo Usuario';
    Utils.openModal('modal-usuario');
  },

  async editUsuario(id){
    const userId = String(id || '').trim();
    if (!userId) return;
    try {
      const resp = await apiClient.users.get(userId);
      const u = resp?.user || null;
      if(!u) return;
      document.getElementById('m-usr-id').value = String(u.id || '');
      document.getElementById('m-usr-nome').value = u.nome || '';
      document.getElementById('m-usr-email').value = u.email || '';
      document.getElementById('m-usr-senha').value = '';
      document.getElementById('m-usr-role').value = u.role || 'operador';
      document.getElementById('m-usr-ativo').checked = u.ativo !== false;
      document.getElementById('m-usr-title').textContent = 'Editar Usuario';
      Utils.openModal('modal-usuario');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao carregar usuario.';
      Utils.notify(msg, 'error');
    }
  },

  async saveUsuario(){
    const id = String(document.getElementById('m-usr-id').value || '').trim();
    const nome = document.getElementById('m-usr-nome').value.trim();
    const email = document.getElementById('m-usr-email').value.trim();
    const senha = document.getElementById('m-usr-senha').value.trim();
    const role = document.getElementById('m-usr-role').value;
    const ativo = document.getElementById('m-usr-ativo').checked;

    if(!nome || !email){ Utils.notify('Preencha nome e e-mail.','error'); return; }
    if(!id && !senha){ Utils.notify('Informe uma senha.','error'); return; }
    if(senha && senha.length < 8){ Utils.notify('Senha deve ter ao menos 8 caracteres.','error'); return; }

    try {
      if (id) {
        await apiClient.users.update(id, { nome, email, role, ativo });
        if (senha) {
          await apiClient.users.updatePassword(id, senha);
        }
      } else {
        const created = await apiClient.users.create({ nome, email, senha, role });
        const createdId = String(created?.user?.id || '');
        if (createdId && !ativo) {
          await apiClient.users.update(createdId, { ativo: false });
        }
      }

      Utils.closeModal('modal-usuario');
      if (App.currentPage === 'usuarios') {
        await PageUsuarios.render();
      } else {
        App.refreshCurrentPage();
      }
      Utils.notify(id ? 'Usuario atualizado!' : 'Usuario criado!');
    } catch (err) {
      const msg = (err && err.message) || 'Falha ao salvar usuario.';
      Utils.notify(msg, 'error');
    }
  },
};
// Close modal on overlay click
document.addEventListener('click', e=>{ if(e.target.classList.contains('modal-overlay')) e.target.classList.remove('open'); });
