/* ============================================================
   Almox — Pages v4
   ============================================================ */

// ---- ESTOQUE ----
const PageEstoque = {
  _sortDir: 'none',
  render(filter='') {
    const items=Store.getItems(),categorias=Store.getCategorias(),depositos=Store.getDepositos();
    const q=(document.getElementById('est-search')?.value||filter).toLowerCase();
    const catF=document.getElementById('flt-cat')?.value||'';
    const depF=document.getElementById('flt-dep')?.value||'';
    const qtdMin=parseInt(document.getElementById('flt-qtd-min')?.value)||0;
    const qtdMax=document.getElementById('flt-qtd-max')?.value!==''?parseInt(document.getElementById('flt-qtd-max')?.value):Infinity;
    const statusF=document.getElementById('flt-status')?.value||'';
    const cs=document.getElementById('flt-cat'),ds=document.getElementById('flt-dep');
    if(cs){const v=cs.value;cs.innerHTML='<option value="">Todas categorias</option>'+categorias.map(c=>`<option value="${c}"${c===v?' selected':''}>${c}</option>`).join('');}
    if(ds){const v=ds.value;ds.innerHTML='<option value="">Todos depósitos</option>'+depositos.map(d=>`<option value="${d}"${d===v?' selected':''}>${d}</option>`).join('');}
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
    document.getElementById('est-table').innerHTML=list.length===0?Utils.emptyState('Nenhum item encontrado','Tente alterar os filtros.'):`
      <table><thead><tr>
        <th>Cód.</th><th>Descrição</th><th>Categoria</th><th>Depósito</th>
        <th style="text-align:center;cursor:pointer" onclick="PageEstoque.toggleSort()" title="Ordenar por quantidade">
          Qtd. <span style="font-size:11px;color:var(--brand)">${this._sortDir==='desc'?'↓':'↑'}</span>
        </th>
        <th style="text-align:center">Mín.</th>
        <th style="text-align:right">Valor Unit.</th>
        <th style="text-align:center">Status</th>
        ${canEdit?'<th>Ações</th>':''}
      </tr></thead><tbody>
      ${list.map(i=>{
        const semEstoque=i.quantidade===0,baixo=i.quantidade>0&&i.quantidade<i.minimo;
        const statusBadge=semEstoque?`<span class="badge badge-red">Sem estoque</span>`:baixo?`<span class="badge badge-orange">Baixo</span>`:`<span class="badge badge-green">Ok</span>`;
        return `<tr>
          <td><span style="font-size:12px;font-family:var(--mono);color:var(--brand);font-weight:500">${i.codigo||'—'}</span></td>
          <td><div class="tbl-item">${Utils.itemIcon()}<div><div class="tbl-name">${i.descricao}</div><div class="tbl-sub">${i.obs||'—'}</div></div></div></td>
          <td><span class="badge badge-blue">${i.categoria}</span></td>
          <td><span style="font-size:12.5px;color:var(--text-2)">${i.deposito}</span></td>
          <td style="text-align:center">${Utils.qtyBadge(i.quantidade,i.minimo)}</td>
          <td style="text-align:center"><span style="font-size:12.5px;color:var(--text-3)">${i.minimo}</span></td>
          <td style="text-align:right"><span style="font-size:12.5px;font-family:var(--mono)">R$ ${(i.valor||0).toFixed(2)}</span></td>
          <td style="text-align:center">${statusBadge}</td>
          ${canEdit?`<td><div class="tbl-actions">
            <button class="btn-icon" title="Entrada" onclick="Modals.openEntradaFor(${i.id})"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg></button>
            <button class="btn-icon" title="Saída"   onclick="Modals.openSaidaFor(${i.id})"><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
            <button class="btn-icon" title="Editar"  onclick="Modals.editItem(${i.id})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            ${Auth.isAdmin()?`<button class="btn-icon danger" title="Excluir" onclick="Modals.deleteItem(${i.id})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`:''}
          </div></td>`:''}
        </tr>`;
      }).join('')}
      </tbody></table>`;
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
  render(filter=''){
    const f=(document.getElementById('ent-search')?.value||filter).toLowerCase();
    const list=Store.getEntradas().filter(e=>!f||e.itemNome.toLowerCase().includes(f)||(e.itemCodigo||'').toLowerCase().includes(f)||(e.resp||'').toLowerCase().includes(f)).slice().reverse();
    document.getElementById('ent-table').innerHTML=list.length===0?Utils.emptyState('Nenhuma entrada registrada'):`
      <table><thead><tr><th>Cód.</th><th>Item</th><th>Qtd.</th><th>Valor Total</th><th>Data</th><th>Responsável</th><th>Obs.</th></tr></thead>
      <tbody>${list.map(e=>`<tr>
        <td><span style="font-size:12px;font-family:var(--mono);color:var(--brand)">${e.itemCodigo||'—'}</span></td>
        <td><div class="tbl-item">${Utils.itemIcon()}<div class="tbl-name">${e.itemNome}</div></div></td>
        <td><span class="qty qty-in">+${e.qtd}</span></td>
        <td><span style="font-size:12.5px;font-family:var(--mono)">R$ ${((e.valorUnit||0)*e.qtd).toFixed(2)}</span></td>
        <td><span style="font-size:12.5px">${Utils.fmtDate(e.data)}</span></td>
        <td><span style="font-size:12.5px">${e.resp||'—'}</span></td>
        <td><span style="font-size:12.5px;color:var(--text-3)">${e.obs||'—'}</span></td>
      </tr>`).join('')}</tbody></table>`;
  }
};

// ---- SAÍDAS ----
const PageSaidas = {
  render(filter=''){
    const f=(document.getElementById('sai-search')?.value||filter).toLowerCase();
    const list=Store.getSaidas().filter(s=>!f||s.itemNome.toLowerCase().includes(f)||(s.itemCodigo||'').toLowerCase().includes(f)||(s.funcNome||'').toLowerCase().includes(f)||(s.setor||'').toLowerCase().includes(f)).slice().reverse();
    document.getElementById('sai-table').innerHTML=list.length===0?Utils.emptyState('Nenhuma saída registrada'):`
      <table><thead><tr><th>Cód.</th><th>Item</th><th>Qtd.</th><th>Valor Total</th><th>Data</th><th>Funcionário</th><th>Setor</th><th>Ações</th></tr></thead>
      <tbody>${list.map(s=>`<tr>
        <td><span style="font-size:12px;font-family:var(--mono);color:var(--brand)">${s.itemCodigo||'—'}</span></td>
        <td><div class="tbl-item">${Utils.itemIcon()}<div class="tbl-name">${s.itemNome}</div></div></td>
        <td><span class="qty qty-out">−${s.qtd}</span></td>
        <td><span style="font-size:12.5px;font-family:var(--mono)">R$ ${((s.valorUnit||0)*s.qtd).toFixed(2)}</span></td>
        <td><span style="font-size:12.5px">${Utils.fmtDate(s.data)}</span></td>
        <td><div class="tbl-item" style="gap:8px">${Utils.avatarHtml(s.funcNome||s.resp||'?','sm')}<span style="font-size:12.5px">${s.funcNome||s.resp||'—'}</span></div></td>
        <td><span class="badge badge-gray">${s.setor||'—'}</span></td>
        <td><button class="btn-icon" title="Ver Termo" onclick="Impressao.termoRetirada(${s.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></button></td>
      </tr>`).join('')}</tbody></table>`;
  }
};

// ---- CONTROLE DE ACESSO ----
const PageAcesso = {
  render(filter=''){
    const f=(document.getElementById('ac-search')?.value||filter).toLowerCase();
    const list=Store.getAcessos().filter(a=>!f||a.nome.toLowerCase().includes(f)||(a.cargo||'').toLowerCase().includes(f));
    document.getElementById('ac-table').innerHTML=list.length===0?Utils.emptyState('Nenhum acesso registrado'):`
      <table><thead><tr><th>Pessoa</th><th>Tipo</th><th>Horário</th><th>Data</th><th>Cargo</th></tr></thead>
      <tbody>${list.map(a=>`<tr>
        <td><div class="tbl-item">${Utils.avatarHtml(a.nome,'md')}<div class="tbl-name">${a.nome}</div></div></td>
        <td><span class="badge ${a.tipo==='Entrada'?'badge-green':'badge-red'} badge-dot">${a.tipo}</span></td>
        <td><span style="font-size:13px;font-weight:500;font-family:var(--mono)">${a.hora}</span></td>
        <td><span style="font-size:12.5px">${Utils.fmtDate(a.data)}</span></td>
        <td><span style="font-size:12.5px;color:var(--text-2)">${a.cargo||'—'}</span></td>
      </tr>`).join('')}</tbody></table>`;
  }
};

// ---- FUNCIONÁRIOS ----
const PageFuncionarios = {
  render(filter=''){
    const f=(document.getElementById('func-search')?.value||filter).toLowerCase();
    const setores=Store.getSetores();
    const setorF=document.getElementById('func-setor-f')?.value||'';
    const sel=document.getElementById('func-setor-f');
    if(sel){const v=sel.value;sel.innerHTML='<option value="">Todos setores</option>'+setores.map(s=>`<option value="${s}"${s===v?' selected':''}>${s}</option>`).join('');}
    const list=Store.getFuncionarios().filter(fn=>
      (!f||fn.nome.toLowerCase().includes(f)||(fn.cargo||'').toLowerCase().includes(f))&&
      (!setorF||fn.setor===setorF)
    );
    document.getElementById('func-table').innerHTML=list.length===0?Utils.emptyState('Nenhum funcionário cadastrado'):`
      <table><thead><tr><th>Funcionário</th><th>Setor</th><th>Cargo</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody>${list.map(fn=>`<tr>
        <td><div class="tbl-item">${Utils.avatarHtml(fn.nome,'md')}<div class="tbl-name">${fn.nome}</div></div></td>
        <td><span class="badge badge-blue">${fn.setor}</span></td>
        <td><span style="font-size:12.5px;color:var(--text-2)">${fn.cargo||'—'}</span></td>
        <td><span class="badge ${fn.ativo!==false?'badge-green':'badge-red'}">${fn.ativo!==false?'Ativo':'Inativo'}</span></td>
        <td><div class="tbl-actions">
          <button class="btn-icon" title="Editar" onclick="Modals.editFuncionario(${fn.id})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon" title="${fn.ativo!==false?'Desativar':'Ativar'}" onclick="PageFuncionarios.toggleAtivo(${fn.id})"><svg viewBox="0 0 24 24">${fn.ativo!==false?'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>':'<polyline points="20 6 9 17 4 12"/>'}
          </svg></button>
          <button class="btn-icon danger" title="Excluir permanentemente" onclick="PageFuncionarios.deleteFuncionario(${fn.id})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
        </div></td>
      </tr>`).join('')}</tbody></table>`;
  },
  toggleAtivo(id){
    const fns=Store.getFuncionarios(),fn=fns.find(x=>x.id===id);
    if(!fn)return;fn.ativo=fn.ativo===false;Store.setFuncionarios(fns);this.render();Utils.notify(`${fn.nome} ${fn.ativo?'ativado':'desativado'}!`);
  },
  deleteFuncionario(id){
    const fn=Store.getFuncionarios().find(x=>x.id===id); if(!fn)return;
    if(!confirm(`Excluir permanentemente "${fn.nome}"? Esta ação não pode ser desfeita.`))return;
    Store.setFuncionarios(Store.getFuncionarios().filter(x=>x.id!==id));
    this.render(); Utils.notify('Funcionário excluído!');
  }
};

// ---- USUÁRIOS ----
const PageUsuarios = {
  render(){
    if(!Auth.isAdmin()){document.getElementById('usuarios-table').innerHTML=Utils.emptyState('Acesso restrito');return;}
    const users=Store.getUsers();
    document.getElementById('usuarios-table').innerHTML=`
      <table><thead><tr><th>Usuário</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody>${users.map(u=>`<tr>
        <td><div class="tbl-item">${Utils.avatarHtml(u.nome,'md')}<div class="tbl-name">${u.nome}</div></div></td>
        <td><span style="font-size:12.5px;font-family:var(--mono)">${u.email}</span></td>
        <td><span class="badge ${u.role==='admin'?'badge-blue':u.role==='gerente'?'badge-orange':'badge-gray'}">${ROLE_LABELS[u.role]||u.role}</span></td>
        <td><span class="badge ${u.ativo!==false?'badge-green':'badge-red'}">${u.ativo!==false?'Ativo':'Inativo'}</span></td>
        <td><div class="tbl-actions">
          <button class="btn-icon" title="Editar" onclick="Modals.editUsuario(${u.id})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          ${u.id!==Auth.currentUser.id?`
            <button class="btn-icon" title="${u.ativo!==false?'Desativar':'Ativar'}" onclick="PageUsuarios.toggleAtivo(${u.id})"><svg viewBox="0 0 24 24">${u.ativo!==false?'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>':'<polyline points="20 6 9 17 4 12"/>'}
            </svg></button>
            <button class="btn-icon danger" title="Excluir permanentemente" onclick="PageUsuarios.deleteUser(${u.id})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
          `:'<span style="font-size:11px;color:var(--text-3)">Você</span>'}
        </div></td>
      </tr>`).join('')}</tbody></table>`;
  },
  toggleAtivo(id){const users=Store.getUsers(),u=users.find(x=>x.id===id);if(!u)return;u.ativo=u.ativo===false;Store.setUsers(users);this.render();Utils.notify(`Usuário ${u.ativo?'ativado':'desativado'}!`);},
  deleteUser(id){
    const u=Store.getUsers().find(x=>x.id===id); if(!u)return;
    if(!confirm(`Excluir permanentemente "${u.nome}"? Esta ação não pode ser desfeita.`))return;
    Store.setUsers(Store.getUsers().filter(x=>x.id!==id));
    this.render(); Utils.notify('Usuário excluído!');
  }
};

// ---- RELATÓRIOS ----
const PageRelatorios = {
  _periodo: 30,
  render(){
    this._renderMetricas();
    this._renderPorSetor();
    this._renderHistorico();
  },

  _cutoff(dias){ const d=new Date();d.setDate(d.getDate()-dias);return d.toISOString().split('T')[0]; },

  _renderMetricas(){
    const items=Store.getItems(),entradas=Store.getEntradas(),saidas=Store.getSaidas();
    const p=this._periodo, corte=this._cutoff(p);
    const saidasP=saidas.filter(s=>s.data>=corte);
    const entradasP=entradas.filter(e=>e.data>=corte);
    const totalQtd=items.reduce((s,i)=>s+i.quantidade,0);
    const totalValor=items.reduce((s,i)=>s+(i.quantidade*(i.valor||0)),0);
    const gastoP=saidasP.reduce((s,x)=>s+(x.qtd*(x.valorUnit||0)),0);
    const qtdSaidaP=saidasP.reduce((s,x)=>s+x.qtd,0);
    const qtdEntradaP=entradasP.reduce((s,x)=>s+x.qtd,0);
    const baixo=items.filter(i=>i.quantidade<i.minimo);

    document.getElementById('rel-metricas').innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;">
          <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Valor em Estoque</div>
          <div style="font-size:22px;font-weight:700;color:var(--text)">R$ ${totalValor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:4px;">${totalQtd} unidades · ${items.length} tipos</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;">
          <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Gasto em ${p} dias</div>
          <div style="font-size:22px;font-weight:700;color:var(--red)">R$ ${gastoP.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:4px;">${qtdSaidaP} unidades retiradas · ${saidasP.length} movimentações</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;">
          <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Entradas em ${p} dias</div>
          <div style="font-size:22px;font-weight:700;color:var(--green)">+${qtdEntradaP} un.</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:4px;">${entradasP.length} reposições realizadas</div>
        </div>
      </div>
      ${baixo.length>0?`<div style="padding:12px 14px;background:var(--red-bg);border:1px solid var(--red-border);border-radius:var(--r);margin-bottom:16px;">
        <div style="font-size:12px;font-weight:600;color:var(--red);margin-bottom:6px;">⚠ ${baixo.length} item(s) abaixo do mínimo:</div>
        ${baixo.map(i=>`<div style="font-size:12px;margin-top:3px;">• <strong>${i.codigo||''}</strong> ${i.descricao}: <strong>${i.quantidade}</strong> / ${i.minimo} mín.</div>`).join('')}
      </div>`:''}`;
  },

  _renderPorSetor(){
    const saidas=Store.getSaidas();
    const p=this._periodo, corte=this._cutoff(p);
    const saidasP=saidas.filter(s=>s.data>=corte);

    // Group by setor
    const setorMap={};
    saidasP.forEach(s=>{
      const setor=s.setor||'Não informado';
      if(!setorMap[setor]) setorMap[setor]={total:0,qtd:0,movs:[],itens:{}};
      setorMap[setor].total+=(s.qtd*(s.valorUnit||0));
      setorMap[setor].qtd+=s.qtd;
      setorMap[setor].movs.push(s);
      const key=s.itemNome;
      if(!setorMap[setor].itens[key]) setorMap[setor].itens[key]={qtd:0,valor:0,codigo:s.itemCodigo||''};
      setorMap[setor].itens[key].qtd+=s.qtd;
      setorMap[setor].itens[key].valor+=(s.qtd*(s.valorUnit||0));
    });

    const totalGasto=Object.values(setorMap).reduce((s,x)=>s+x.total,0);

    if(Object.keys(setorMap).length===0){
      document.getElementById('rel-setores').innerHTML=Utils.emptyState('Nenhuma movimentação neste período');
      return;
    }

    document.getElementById('rel-setores').innerHTML=Object.entries(setorMap)
      .sort((a,b)=>b[1].total-a[1].total)
      .map(([setor,data])=>{
        const pct=totalGasto>0?Math.round(data.total/totalGasto*100):0;
        const itensHtml=Object.entries(data.itens).sort((a,b)=>b[1].valor-a[1].valor).map(([nome,d])=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12.5px;">
            <div><span style="font-family:var(--mono);color:var(--brand);font-size:11px;margin-right:6px;">${d.codigo}</span>${nome}</div>
            <div style="display:flex;gap:16px;text-align:right;flex-shrink:0;">
              <span style="color:var(--text-3)">${d.qtd} un.</span>
              <span style="font-weight:600;font-family:var(--mono)">R$ ${d.valor.toFixed(2)}</span>
            </div>
          </div>`).join('');

        // Funcionários do setor
        const funcMap={};
        data.movs.forEach(m=>{const fn=m.funcNome||m.resp||'?';if(!funcMap[fn])funcMap[fn]={qtd:0,valor:0};funcMap[fn].qtd+=m.qtd;funcMap[fn].valor+=(m.qtd*(m.valorUnit||0));});
        const funcHtml=Object.entries(funcMap).sort((a,b)=>b[1].valor-a[1].valor).map(([nome,d])=>`
          <div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px;">
            ${Utils.avatarHtml(nome,'sm')}
            <span style="flex:1">${nome}</span>
            <span style="color:var(--text-3)">${d.qtd} un.</span>
            <span style="font-weight:600;font-family:var(--mono);min-width:80px;text-align:right">R$ ${d.valor.toFixed(2)}</span>
          </div>`).join('');

        return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;margin-bottom:12px;">
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
              <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Funcionários</div>
              ${funcHtml||'<span style="font-size:12px;color:var(--text-3)">Nenhum</span>'}
            </div>
          </div>
        </div>`;
      }).join('');
  },

  _renderHistorico(){
    const entradas=Store.getEntradas(),saidas=Store.getSaidas();
    const p=this._periodo,corte=this._cutoff(p);
    const hist=[
      ...entradas.filter(e=>e.data>=corte).map(e=>({...e,tipo:'Entrada'})),
      ...saidas.filter(s=>s.data>=corte).map(s=>({...s,tipo:'Saída'}))
    ].sort((a,b)=>new Date(b.data)-new Date(a.data));
    document.getElementById('rel-hist').innerHTML=hist.length===0?Utils.emptyState('Nenhuma movimentação neste período'):`
      <table><thead><tr><th>Tipo</th><th>Cód.</th><th>Item</th><th>Qtd.</th><th>Valor</th><th>Data</th><th>Funcionário/Resp.</th><th>Setor</th></tr></thead>
      <tbody>${hist.map(h=>`<tr>
        <td><span class="badge ${h.tipo==='Entrada'?'badge-green':'badge-red'} badge-dot">${h.tipo}</span></td>
        <td><span style="font-size:12px;font-family:var(--mono);color:var(--brand)">${h.itemCodigo||'—'}</span></td>
        <td>${h.itemNome}</td>
        <td><span class="qty ${h.tipo==='Entrada'?'qty-in':'qty-out'}">${h.tipo==='Entrada'?'+':'−'}${h.qtd}</span></td>
        <td><span style="font-size:12.5px;font-family:var(--mono)">R$ ${((h.valorUnit||0)*h.qtd).toFixed(2)}</span></td>
        <td><span style="font-size:12.5px">${Utils.fmtDate(h.data)}</span></td>
        <td><span style="font-size:12.5px">${h.funcNome||h.resp||'—'}</span></td>
        <td><span style="font-size:12px;color:var(--text-3)">${h.setor||'—'}</span></td>
      </tr>`).join('')}</tbody></table>`;
  },

  setPeriodo(p){
    this._periodo=p;
    document.querySelectorAll('.periodo-btn').forEach(b=>{
      b.style.background=parseInt(b.dataset.p)===p?'var(--brand)':'var(--surface)';
      b.style.color=parseInt(b.dataset.p)===p?'#fff':'var(--text-2)';
    });
    this.render();
  }
};

// ---- CONFIGURAÇÕES ----
const PageConfig = {
  render(){
    const categorias=Store.getCategorias(),depositos=Store.getDepositos(),setores=Store.getSetores();
    document.getElementById('cfg-cats').innerHTML=categorias.map((c,i)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);"><span style="font-size:13px">${c}</span><button class="btn btn-ghost btn-xs" onclick="PageConfig.deleteCat(${i})">Remover</button></div>`).join('')||'<div style="font-size:13px;color:var(--text-3);padding:10px 0">Nenhuma categoria</div>';
    document.getElementById('cfg-deps').innerHTML=depositos.map((d,i)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);"><span style="font-size:13px">${d}</span><button class="btn btn-ghost btn-xs" onclick="PageConfig.deleteDep(${i})">Remover</button></div>`).join('')||'<div style="font-size:13px;color:var(--text-3);padding:10px 0">Nenhum depósito</div>';
    document.getElementById('cfg-setores').innerHTML=setores.map((s,i)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);"><span style="font-size:13px">${s}</span><button class="btn btn-ghost btn-xs" onclick="PageConfig.deleteSetor(${i})">Remover</button></div>`).join('')||'<div style="font-size:13px;color:var(--text-3);padding:10px 0">Nenhum setor</div>';
  },
  addCat(){const v=document.getElementById('cfg-new-cat').value.trim();if(!v)return;const cats=Store.getCategorias();cats.push(v);Store.setCategorias(cats);document.getElementById('cfg-new-cat').value='';this.render();Utils.notify('Categoria adicionada!');},
  deleteCat(i){const cats=Store.getCategorias();cats.splice(i,1);Store.setCategorias(cats);this.render();Utils.notify('Removida!');},
  addDep(){const v=document.getElementById('cfg-new-dep').value.trim();if(!v)return;const deps=Store.getDepositos();deps.push(v);Store.setDepositos(deps);document.getElementById('cfg-new-dep').value='';this.render();Utils.notify('Depósito adicionado!');},
  deleteDep(i){const deps=Store.getDepositos();deps.splice(i,1);Store.setDepositos(deps);this.render();Utils.notify('Removido!');},
  addSetor(){const v=document.getElementById('cfg-new-setor').value.trim();if(!v)return;const ss=Store.getSetores();ss.push(v);Store.setSetores(ss);document.getElementById('cfg-new-setor').value='';this.render();Utils.notify('Setor adicionado!');},
  deleteSetor(i){const ss=Store.getSetores();ss.splice(i,1);Store.setSetores(ss);this.render();Utils.notify('Removido!');},
};

// ---- IMPRESSÃO ----
const Impressao = {
  _janela(html){const w=window.open('','_blank','width=800,height=700');w.document.write(html);w.document.close();w.onload=()=>{w.focus();w.print();};},

  _base(title,conteudo,termica=false){
    const css=termica?`body{font-family:monospace;font-size:11px;width:280px;margin:0 auto}h2{font-size:13px;text-align:center;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:8px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{padding:3px 4px;text-align:left}th{border-bottom:1px solid #000;font-weight:bold}.right{text-align:right}.footer{text-align:center;margin-top:10px;border-top:1px dashed #000;padding-top:6px;font-size:9px}`
    :`body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:30px}h2{font-size:18px;margin-bottom:4px;color:#1A56DB}h3{font-size:14px;margin:20px 0 8px;color:#333}.sub{color:#666;font-size:11px;margin-bottom:16px}table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#1A56DB;color:#fff;padding:8px 10px;text-align:left;font-size:11px}td{padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px}tr:nth-child(even) td{background:#f7f8fa}.badge-in{color:#059669;font-weight:bold}.badge-out{color:#DC2626;font-weight:bold}.low{color:#DC2626;font-weight:bold}.assinatura{margin-top:40px;border-top:1px solid #ccc;padding-top:10px;font-size:11px;color:#666}.footer{margin-top:20px;font-size:10px;color:#999;text-align:center}@media print{button{display:none}}`;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>${css}</style></head><body>${conteudo}</body></html>`;
  },

  termoRetirada(saidaId){
    const saida=Store.getSaidas().find(s=>s.id===saidaId);
    if(!saida){Utils.notify('Saída não encontrada','error');return;}
    const item=Store.getItems().find(i=>i.id===saida.itemId)||{};
    const now=new Date().toLocaleDateString('pt-BR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    const html=`
      <div style="text-align:center;margin-bottom:24px;border-bottom:2px solid #1A56DB;padding-bottom:16px;">
        <h2 style="margin-bottom:4px;">TERMO DE RETIRADA DE MATERIAL</h2>
        <div class="sub">Almox — Sistema de Gestão de Almoxarifado</div>
      </div>
      <table style="margin-bottom:20px;">
        <tr><td style="width:140px;color:#666;font-weight:600">Nº do Termo:</td><td><strong>#${String(saidaId).padStart(5,'0')}</strong></td><td style="width:140px;color:#666;font-weight:600">Data da retirada:</td><td>${Utils.fmtDate(saida.data)}</td></tr>
        <tr><td style="color:#666;font-weight:600">Funcionário:</td><td><strong>${saida.funcNome||saida.resp||'—'}</strong></td><td style="color:#666;font-weight:600">Setor:</td><td>${saida.setor||'—'}</td></tr>
      </table>
      <h3>Material Retirado</h3>
      <table>
        <thead><tr><th>Cód.</th><th>Descrição</th><th>Qtd.</th><th>Valor Unit.</th><th>Total</th></tr></thead>
        <tbody>
          <tr>
            <td>${saida.itemCodigo||'—'}</td>
            <td>${saida.itemNome}</td>
            <td>${saida.qtd}</td>
            <td>R$ ${(saida.valorUnit||0).toFixed(2)}</td>
            <td><strong>R$ ${((saida.valorUnit||0)*saida.qtd).toFixed(2)}</strong></td>
          </tr>
        </tbody>
      </table>
      ${saida.obs?`<p style="margin-top:12px;font-size:12px;color:#666"><strong>Observação:</strong> ${saida.obs}</p>`:''}
      <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;">
        <div class="assinatura"><div style="margin-bottom:30px"></div><div>_______________________________</div><div style="margin-top:6px"><strong>${saida.funcNome||saida.resp||'Funcionário'}</strong></div><div style="font-size:10px;color:#999">${saida.setor||''} — Assinatura do requerente</div></div>
        <div class="assinatura"><div style="margin-bottom:30px"></div><div>_______________________________</div><div style="margin-top:6px"><strong>Responsável pelo Almoxarifado</strong></div><div style="font-size:10px;color:#999">Assinatura e carimbo</div></div>
      </div>
      <div class="footer">Almox — Emitido em ${now} · Documento de controle interno</div>`;
    this._janela(this._base('Termo de Retirada',html,false));
  },

  estoque(termica=false){
    const items=Store.getItems(),now=new Date().toLocaleString('pt-BR');
    if(termica){
      const linhas=items.map(i=>`<tr><td>${(i.codigo||'').substring(0,8)}</td><td>${i.descricao.substring(0,16)}</td><td class="right">${i.quantidade}${i.quantidade<i.minimo?' !':''}</td></tr>`).join('');
      this._janela(this._base('Estoque',`<h2>ALMOXARIFADO<br>Estoque Atual</h2><div style="text-align:center;font-size:9px;margin-bottom:8px">${now}</div><table><tr><th>Cód</th><th>Item</th><th class="right">Qtd</th></tr>${linhas}</table><div class="footer">! = abaixo do mínimo</div>`,true));
    } else {
      const totalValor=items.reduce((s,i)=>s+(i.quantidade*(i.valor||0)),0);
      const linhas=items.map(i=>`<tr><td>${i.codigo||'—'}</td><td>${i.descricao}</td><td>${i.categoria}</td><td>${i.deposito}</td><td>${i.quantidade<i.minimo?`<span class="low">${i.quantidade} ⚠</span>`:i.quantidade}</td><td>${i.minimo}</td><td>R$ ${(i.valor||0).toFixed(2)}</td><td>R$ ${((i.valor||0)*i.quantidade).toFixed(2)}</td></tr>`).join('');
      this._janela(this._base('Estoque',`<h2>Relatório de Estoque</h2><div class="sub">Emitido em ${now} · ${items.length} tipos · Valor total: R$ ${totalValor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><table><tr><th>Cód.</th><th>Descrição</th><th>Categoria</th><th>Depósito</th><th>Qtd.</th><th>Mín.</th><th>Valor Unit.</th><th>Total</th></tr>${linhas}</table>`,false));
    }
  },

  movimentacoes(termica=false){
    const entradas=Store.getEntradas(),saidas=Store.getSaidas();
    const hist=[...entradas.map(e=>({...e,tipo:'E'})),...saidas.map(s=>({...s,tipo:'S'}))].sort((a,b)=>new Date(b.data)-new Date(a.data));
    const now=new Date().toLocaleString('pt-BR');
    if(termica){
      this._janela(this._base('Movimentações',`<h2>MOVIMENTAÇÕES</h2><div style="text-align:center;font-size:9px;margin-bottom:8px">${now}</div><table><tr><th>Tp</th><th>Item</th><th class="right">Qtd</th></tr>${hist.map(h=>`<tr><td>${h.tipo}</td><td>${h.itemNome.substring(0,14)}</td><td class="right">${h.tipo==='E'?'+':'-'}${h.qtd}</td></tr>`).join('')}</table><div class="footer">${hist.length} registros</div>`,true));
    } else {
      const linhas=hist.map(h=>`<tr><td><span class="${h.tipo==='E'?'badge-in':'badge-out'}">${h.tipo==='E'?'Entrada':'Saída'}</span></td><td>${h.itemCodigo||'—'}</td><td>${h.itemNome}</td><td>${h.tipo==='E'?'+':'-'}${h.qtd}</td><td>R$ ${((h.valorUnit||0)*h.qtd).toFixed(2)}</td><td>${h.data.split('-').reverse().join('/')}</td><td>${h.funcNome||h.resp||'—'}</td><td>${h.setor||'—'}</td></tr>`).join('');
      this._janela(this._base('Movimentações',`<h2>Relatório de Movimentações</h2><div class="sub">Emitido em ${now} · ${hist.length} registros</div><table><tr><th>Tipo</th><th>Cód.</th><th>Item</th><th>Qtd.</th><th>Valor</th><th>Data</th><th>Funcionário</th><th>Setor</th></tr>${linhas}</table>`,false));
    }
  },

  acessos(termica=false){
    const lista=Store.getAcessos(),now=new Date().toLocaleString('pt-BR');
    if(termica){
      this._janela(this._base('Acesso',`<h2>CONTROLE DE ACESSO</h2><table><tr><th>Nome</th><th>T</th><th>Hora</th></tr>${lista.map(a=>`<tr><td>${a.nome.substring(0,14)}</td><td>${a.tipo==='Entrada'?'E':'S'}</td><td>${a.hora}</td></tr>`).join('')}</table>`,true));
    } else {
      this._janela(this._base('Acesso',`<h2>Controle de Acesso</h2><div class="sub">${now}</div><table><tr><th>Nome</th><th>Tipo</th><th>Hora</th><th>Data</th><th>Cargo</th></tr>${lista.map(a=>`<tr><td>${a.nome}</td><td><span class="${a.tipo==='Entrada'?'badge-in':'badge-out'}">${a.tipo}</span></td><td>${a.hora}</td><td>${Utils.fmtDate(a.data)}</td><td>${a.cargo||'—'}</td></tr>`).join('')}</table>`,false));
    }
  },

  setorPDF(setor){
    const saidas=Store.getSaidas().filter(s=>s.setor===setor);
    const now=new Date().toLocaleString('pt-BR');
    const total=saidas.reduce((s,x)=>s+(x.qtd*(x.valorUnit||0)),0);
    const linhas=saidas.sort((a,b)=>new Date(b.data)-new Date(a.data)).map(s=>`<tr><td>${Utils.fmtDate(s.data)}</td><td>${s.itemCodigo||'—'}</td><td>${s.itemNome}</td><td>${s.qtd}</td><td>R$ ${(s.valorUnit||0).toFixed(2)}</td><td><strong>R$ ${((s.valorUnit||0)*s.qtd).toFixed(2)}</strong></td><td>${s.funcNome||s.resp||'—'}</td></tr>`).join('');
    this._janela(this._base(`Relatório ${setor}`,`<h2>Relatório por Setor: ${setor}</h2><div class="sub">Emitido em ${now} · ${saidas.length} retiradas · Total: R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><table><tr><th>Data</th><th>Cód.</th><th>Item</th><th>Qtd.</th><th>Unit.</th><th>Total</th><th>Funcionário</th></tr>${linhas}</table>`,false));
  }
};
