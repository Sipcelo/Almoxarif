/* ============================================================
   ALMOXARIFADO — Utilities
   ============================================================ */

// ---- DATE HELPERS ----
const Utils = {
  today() { return new Date().toISOString().split('T')[0]; },

  nowTime() {
    const n = new Date();
    return n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');
  },

  fmtDate(str) {
    if (!str) return '—';
    const [y,m,d] = str.split('-');
    return `${d}/${m}/${y}`;
  },

  relDate(str) {
    if (!str) return '';
    const t = Utils.today();
    if (str === t) return 'Hoje';
    const y = new Date(); y.setDate(y.getDate()-1);
    if (str === y.toISOString().split('T')[0]) return 'Ontem';
    const diff = Math.round((new Date(t) - new Date(str)) / 86400000);
    if (diff < 7) return `${diff} dias atrás`;
    return Utils.fmtDate(str);
  },

  initials(name) {
    return (name || '?').split(' ').map(p => p[0]).join('').substring(0,2).toUpperCase();
  },

  // ---- NOTIFICATION ----
  notify(msg, type = 'success') {
    const n = document.getElementById('notif');
    if (!n) return;
    n.textContent = '';
    const icon = document.createElement('span');
    icon.innerHTML = type === 'success'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${type==='success'?'#059669':'#DC2626'}" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    const txt = document.createElement('span');
    txt.textContent = msg;
    n.appendChild(icon);
    n.appendChild(txt);
    n.className = 'notif' + (type === 'error' ? ' error' : '');
    clearTimeout(n._t);
    requestAnimationFrame(() => n.classList.add('show'));
    n._t = setTimeout(() => n.classList.remove('show'), 3500);
  },

  // ---- MODAL ----
  openModal(id) { document.getElementById(id)?.classList.add('open'); },
  closeModal(id) { document.getElementById(id)?.classList.remove('open'); },

  // ---- FILL SELECTS ----
  fillSelect(id, arr, placeholder = null) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '') +
      arr.map(v => `<option value="${v}">${v}</option>`).join('');
  },

  fillItemSelect(id, items, placeholder = 'Selecionar item...') {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder}</option>` +
      items.map(i => `<option value="${i.id}">${i.descricao} (${i.quantidade} em estoque)</option>`).join('');
  },

  // ---- AVATARS ----
  avatarHtml(name, size = 'md') {
    const colors = ['#1A56DB','#059669','#D97706','#7C3AED','#DC2626','#0891B2'];
    const idx = (name || '?').charCodeAt(0) % colors.length;
    return `<div class="avatar avatar-${size}" style="background:${colors[idx]}20;color:${colors[idx]};border-color:${colors[idx]}40;">${Utils.initials(name)}</div>`;
  },

  // ---- ITEM ICON ----
  itemIcon() {
    return `<div class="tbl-thumb"><svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></div>`;
  },

  // ---- EMPTY STATE ----
  emptyState(msg = 'Nenhum registro encontrado', sub = '') {
    return `<div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="9" y1="12" x2="15" y2="12"/></svg>
      <div class="empty-title">${msg}</div>
      ${sub ? `<div class="empty-sub">${sub}</div>` : ''}
    </div>`;
  },

  // ---- QTY BADGE ----
  qtyBadge(n, minimo = null) {
    if (minimo !== null) {
      const cls = n < minimo ? 'qty-low' : n < minimo * 2 ? 'qty-neutral' : 'qty-ok';
      return `<span class="qty ${cls}">${n}</span>`;
    }
    return `<span class="qty qty-neutral">${n}</span>`;
  },

  // ---- EXPORT JSON ----
  exportJSON() {
    const data = {
      items: Store.getItems(),
      entradas: Store.getEntradas(),
      saidas: Store.getSaidas(),
      acessos: Store.getAcessos(),
      categorias: Store.getCategorias(),
      depositos: Store.getDepositos(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `almoxarifado_${Utils.today()}.json`;
    a.click();
    Utils.notify('Dados exportados com sucesso!');
  },
};
