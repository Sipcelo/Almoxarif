/* ============================================================
   Almox — App Controller v4
   ============================================================ */

const App = {
  currentPage: 'painel',
  activities: [
    {text:'<strong>Daniel Santos</strong>: Retirada de Teclado Sem Fio — TI',         color:'red',  time:'12 dias'},
    {text:'<strong>Marina Rodrigues</strong>: Retirada de Papel Sulfite A4 — Operações',color:'red', time:'8 dias'},
    {text:'<strong>João Almeida</strong>: Entrada de HD Externo 1TB (+3)',              color:'green',time:'2 dias'},
    {text:'<strong>Elisa Gomes</strong>: Entrada de Papel Sulfite A4 (+50)',            color:'green',time:'1 dia'},
    {text:'<strong>Elisa Gomes</strong>: Retirada de Caneta Esferográfica — Adm.',     color:'red',  time:'Hoje'},
  ],

  async init() {
    initStore();
    window.addEventListener('almox:session-expired', () => {
      Auth.currentUser = null;
      this.showLoginPage(true);
    });
    const ok = await Auth.init();
    if (ok) { this.showAppPage(); }
    else    { this.showLoginPage(); }
    document.addEventListener('click', e => {
      const panel = document.getElementById('alert-panel');
      const notif  = document.querySelector('.topbar-notif');
      if (panel && !panel.contains(e.target) && notif && !notif.contains(e.target)) {
        panel.style.display = 'none';
      }
    });
  },

  showLoginPage(expired) {
    document.getElementById('login-shell').style.display = '';
    document.getElementById('app-shell').style.display   = 'none';
    const banner = document.getElementById('login-expired-banner');
    if (banner) banner.style.display = expired ? '' : 'none';
    const err = document.getElementById('login-error');
    if (err) err.classList.remove('show');
  },

  showAppPage() {
    document.getElementById('login-shell').style.display = 'none';
    document.getElementById('app-shell').style.display   = '';
    this.updateUserUI();
    this.buildSidebar();
    this.showPage('painel');
    this.updateBadges();
  },

  buildSidebar() {
    document.querySelectorAll('.sidebar-item[data-page]').forEach(el => {
      el.style.display = Auth.can(el.dataset.page) ? '' : 'none';
    });
  },

  updateUserUI() {
    const u = Auth.currentUser;
    if (!u) return;
    document.querySelectorAll('[data-user-name]').forEach(el   => el.textContent = u.nome);
    document.querySelectorAll('[data-user-role]').forEach(el   => el.textContent = ROLE_LABELS[u.role] || u.role);
    document.querySelectorAll('[data-user-avatar]').forEach(el => el.textContent = Utils.initials(u.nome));
  },

  showPage(name) {
    if (!Auth.can(name)) { Utils.notify('Sem permissão para acessar esta área.','error'); return; }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    document.getElementById('page-' + name)?.classList.add('active');
    document.querySelector(`.sidebar-item[data-page="${name}"]`)?.classList.add('active');
    this.currentPage = name;

    const titles = {
      painel:'Painel Inicial', estoque:'Em Estoque', entradas:'Entradas',
      saidas:'Saídas', relatorios:'Relatórios', acesso:'Controle de Acesso',
      funcionarios:'Funcionários', usuarios:'Usuários', configuracoes:'Configurações',
    };
    document.getElementById('topbar-title').textContent      = titles[name] || 'Almox';
    document.getElementById('topbar-breadcrumb').textContent = titles[name] || '';

    const renderers = {
      painel:        () => PageDashboard.render(),
      estoque:       () => PageEstoque.render(),
      entradas:      () => PageEntradas.render(),
      saidas:        () => PageSaidas.render(),
      relatorios:    () => PageRelatorios.render(),
      acesso:        () => PageAcesso.render(),
      funcionarios:  () => PageFuncionarios.render(),
      usuarios:      () => PageUsuarios.render(),
      configuracoes: () => PageConfig.render(),
    };
    const result = renderers[name]?.();
    if (result && typeof result.catch === 'function') {
      result.catch(err => {
        const msg = (err && err.message) || 'Falha ao renderizar página.';
        Utils.notify(msg, 'error');
      });
    }
    this.updateBadges();
    const panel = document.getElementById('alert-panel');
    if (panel) panel.style.display = 'none';
  },

  refreshCurrentPage() { this.showPage(this.currentPage); },

  addActivity(text, color = 'blue') {
    this.activities.unshift({text, color, time:'Agora'});
    if (this.activities.length > 30) this.activities.pop();
  },

  toggleAlertPanel() {
    const panel = document.getElementById('alert-panel');
    if (!panel.style.display || panel.style.display === 'none') {
      this.renderAlertPanel(); panel.style.display = 'block';
    } else { panel.style.display = 'none'; }
  },

  renderAlertPanel() {
    const baixo = Store.getItems().filter(i => i.quantidade < i.minimo);
    const list  = document.getElementById('alert-list');
    if (!list) return;
    if (baixo.length === 0) {
      list.innerHTML = `<div style="padding:24px;text-align:center;"><div style="font-size:28px;margin-bottom:8px;">✅</div><div style="font-size:13px;font-weight:500;">Estoque em dia!</div><div style="font-size:12px;color:var(--text-3);margin-top:4px;">Nenhum item abaixo do mínimo.</div></div>`;
      return;
    }
    list.innerHTML = baixo.map(i => {
      const pct = Math.round((i.quantidade / Math.max(i.minimo,1)) * 100);
      const cor  = i.quantidade === 0 ? 'var(--red)' : 'var(--orange)';
      const icon = i.quantidade === 0 ? '🔴' : '🟠';
      return `<div style="padding:11px 16px;border-bottom:1px solid var(--border);cursor:pointer;" onclick="App.showPage('estoque');document.getElementById('alert-panel').style.display='none'">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;">
          <div><div style="font-size:12.5px;font-weight:500;">${icon} ${i.descricao}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:1px;">${i.categoria} · ${i.deposito} · <span style="font-family:var(--mono)">${i.codigo||''}</span></div>
          </div>
          <div style="text-align:right;flex-shrink:0;"><span style="font-size:13px;font-weight:700;color:${cor}">${i.quantidade}</span><span style="font-size:11px;color:var(--text-3);"> / ${i.minimo}</span></div>
        </div>
        <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
          <div style="height:4px;width:${Math.min(100,pct)}%;background:${cor};border-radius:2px;"></div>
        </div>
        <div style="font-size:10.5px;color:${cor};margin-top:3px;">${i.quantidade===0?'Sem estoque!':`Faltam ${i.minimo-i.quantidade} unidade(s)`}</div>
      </div>`;
    }).join('');
  },

  updateBadges() {
    const baixo = Store.getItems().filter(i => i.quantidade < i.minimo).length;
    // Sidebar badge on Estoque menu item
    const badge = document.getElementById('badge-estoque');
    if (badge) { badge.textContent = baixo; badge.style.display = baixo > 0 ? 'flex' : 'none'; }
    // Topbar dot — ONLY visible when there are alerts
    const dot = document.querySelector('.topbar-notif-dot');
    if (dot) dot.style.display = baixo > 0 ? 'block' : 'none';
    // Count badge on bell icon
    const cb = document.getElementById('notif-count');
    if (cb) { cb.textContent = baixo; cb.style.display = baixo > 0 ? 'flex' : 'none'; }
    // One-time session alert for zeroed items
    const criticos = Store.getItems().filter(i=>i.quantidade===0);
    const sk = 'almox_alerted_'+new Date().toDateString();
    if (criticos.length>0 && !sessionStorage.getItem(sk)) {
      sessionStorage.setItem(sk,'1');
      setTimeout(()=>Utils.notify(`⚠ ${criticos.length} item(s) com estoque zerado!`,'error'),1500);
    }
  },

  async handleLogin(e) {
    e && e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    const btn   = document.getElementById('login-btn');
    const err   = document.getElementById('login-error');
    const msg   = document.getElementById('login-error-msg');
    if (!email || !senha) {
      err.classList.add('show');
      msg.textContent = 'Preencha e-mail e senha.';
      return;
    }
    btn.classList.add('loading');
    err.classList.remove('show');
    const banner = document.getElementById('login-expired-banner');
    if (banner) banner.style.display = 'none';
    const res = await Auth.login(email, senha);
    btn.classList.remove('loading');
    if (res.ok) {
      this.showAppPage();
      return;
    }
    err.classList.add('show');
    const friendly = {
      INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
      RATE_LIMITED: 'Muitas tentativas. Aguarde alguns instantes.',
      VALIDATION_ERROR: 'Dados inválidos. Verifique e tente novamente.',
      NETWORK_ERROR: 'Falha de conexão. Tente novamente.',
      TIMEOUT: 'Tempo de resposta esgotado. Tente novamente.',
    };
    msg.textContent = friendly[res.code] || res.message || 'Erro inesperado.';
    document.getElementById('login-senha').value = '';
  },

  togglePassword() {
    const inp=document.getElementById('login-senha'),icon=document.getElementById('pass-icon');
    if(inp.type==='password'){inp.type='text';icon.innerHTML=`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;}
    else{inp.type='password';icon.innerHTML=`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;}
  },

  globalSearch(v) {
    if(!v)return;
    ({estoque:()=>PageEstoque.render(v),entradas:()=>PageEntradas.render(v),saidas:()=>PageSaidas.render(v),acesso:()=>PageAcesso.render(v),funcionarios:()=>PageFuncionarios.render(v)})[this.currentPage]?.();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
