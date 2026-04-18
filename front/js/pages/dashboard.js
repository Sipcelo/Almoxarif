/* ============================================================
   Almox — Painel Inicial v4
   ============================================================ */
const PageDashboard = {
  accessPage: 1,
  render() {
    const items=Store.getItems(), entradas=Store.getEntradas(), saidas=Store.getSaidas(), acessos=Store.getAcessos();
    const totalQtd=items.reduce((s,i)=>s+i.quantidade,0);
    const totalValor=items.reduce((s,i)=>s+(i.quantidade*(i.valor||0)),0);
    const baixo=items.filter(i=>i.quantidade<i.minimo).length;
    const entHoje=entradas.filter(e=>e.data===today()).reduce((s,e)=>s+e.qtd,0);
    const gastoMes=saidas.filter(s=>s.data>=daysAgo(30)).reduce((s,x)=>s+(x.qtd*(x.valorUnit||0)),0);

    document.getElementById('d-stats').innerHTML=`
      <div class="stat-card">
        <div class="stat-icon stat-icon-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></div>
        <div class="stat-label">Itens Cadastrados</div>
        <div class="stat-value">${items.length}</div>
        <div class="stat-sub">${totalQtd} unidades no total</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon ${baixo>0?'stat-icon-red':'stat-icon-green'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg></div>
        <div class="stat-label">Abaixo do Mínimo</div>
        <div class="stat-value" style="color:${baixo>0?'var(--red)':'var(--green)'}">${baixo}</div>
        <div class="stat-sub ${baixo>0?'stat-down':'stat-up'}">${baixo>0?'▼ Requer reposição':'▲ Estoque adequado'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <div class="stat-label">Funcionários Ativos</div>
        <div class="stat-value">${Store.getFuncionarios().filter(f=>f.ativo!==false).length}</div>
        <div class="stat-sub">${Store.getSetores().length} setores cadastrados</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg></div>
        <div class="stat-label">Saídas este mês</div>
        <div class="stat-value">${saidas.filter(s=>s.data>=daysAgo(30)).reduce((a,b)=>a+b.qtd,0)}</div>
        <div class="stat-sub stat-down">▼ Unidades retiradas</div>
      </div>`;

    const topItems=[...items].sort((a,b)=>b.quantidade-a.quantidade).slice(0,5);
    document.getElementById('d-estoque-body').innerHTML=topItems.map(i=>`
      <tr>
        <td><div class="tbl-item">${Utils.itemIcon()}<div><div class="tbl-name">${i.descricao}</div><div class="tbl-sub" style="font-family:var(--mono)">${i.codigo||''}</div></div></div></td>
        <td><span class="badge badge-blue">${i.categoria}</span></td>
        <td>${Utils.qtyBadge(i.quantidade,i.minimo)}</td>
      </tr>`).join('')||`<tr><td colspan="3">${Utils.emptyState()}</td></tr>`;

    this.renderAccessList(acessos);
    this.renderChart('d-mini-chart',[32,38,45,28,55,42,38,50,58],65);
    this.renderChart('d-big-chart', [32,38,45,28,55,42,38,50,58],105);

    document.getElementById('d-activities').innerHTML=App.activities.slice(0,6).map(a=>`
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);">
        <div style="width:8px;height:8px;border-radius:50%;background:${a.color==='green'?'var(--green)':'var(--red)'};flex-shrink:0;margin-top:5px;"></div>
        <div><div style="font-size:12.5px;line-height:1.5;">${a.text}</div><div style="font-size:11px;color:var(--text-3);margin-top:2px;">${a.time}</div></div>
      </div>`).join('')||Utils.emptyState();

    document.getElementById('d-saidas-semana').textContent=saidas.filter(s=>s.data>=daysAgo(7)).reduce((s,x)=>s+x.qtd,0);
    document.getElementById('d-entradas-hoje').textContent=entHoje||0;
  },

  renderAccessList(acessos,filter=''){
    const f=filter.toLowerCase();
    const filtered=acessos.filter(a=>!f||a.nome.toLowerCase().includes(f));
    const perPage=4,total=filtered.length,totalPages=Math.max(1,Math.ceil(total/perPage));
    if(this.accessPage>totalPages)this.accessPage=1;
    const slice=filtered.slice((this.accessPage-1)*perPage,this.accessPage*perPage);
    document.getElementById('d-access-list').innerHTML=slice.map(a=>`
      <div style="display:flex;align-items:center;gap:11px;padding:11px 16px;border-bottom:1px solid var(--border);">
        ${Utils.avatarHtml(a.nome,'md')}
        <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:500;">${a.nome} <span style="color:var(--text-3);font-size:12px;">${a.hora}</span></div>
          <span class="badge ${a.tipo==='Entrada'?'badge-green':'badge-red'} badge-dot">${a.tipo}</span>
        </div>
        <div style="text-align:right;flex-shrink:0;font-size:11.5px;color:var(--text-3);">${Utils.relDate(a.data)}</div>
      </div>`).join('')||Utils.emptyState();
    document.getElementById('d-access-pagination').innerHTML=`
      <button class="page-btn" onclick="PageDashboard.accessPage=1;PageDashboard.renderAccessList(Store.getAcessos())">«</button>
      <button class="page-btn" onclick="if(PageDashboard.accessPage>1){PageDashboard.accessPage--;PageDashboard.renderAccessList(Store.getAcessos())}">‹</button>
      <span class="page-info">${this.accessPage}/${totalPages}</span>
      <button class="page-btn" onclick="if(PageDashboard.accessPage<${totalPages}){PageDashboard.accessPage++;PageDashboard.renderAccessList(Store.getAcessos())}">›</button>
      <button class="page-btn" onclick="PageDashboard.accessPage=${totalPages};PageDashboard.renderAccessList(Store.getAcessos())">»</button>`;
  },

  renderChart(id,data,h){
    const max=Math.max(...data);
    document.getElementById(id).innerHTML=data.map(v=>`<div class="bar-col"><div class="bar" style="height:${Math.round((v/max)*h)}px"></div></div>`).join('');
  },
};

function daysAgo(n){const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().split('T')[0];}
function today(){return new Date().toISOString().split('T')[0];}
