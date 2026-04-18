/* ============================================================
   Almox — Modals v4
   ============================================================ */

const Modals = {

  // ---- ITEM ----
  openNewItem(){
    Utils.fillSelect('m-item-cat', Store.getCategorias());
    Utils.fillSelect('m-item-dep', Store.getDepositos());
    ['m-item-id','m-item-desc','m-item-codigo','m-item-obs'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
    document.getElementById('m-item-qtd').value='0';
    document.getElementById('m-item-min').value='5';
    document.getElementById('m-item-valor').value='0.00';
    document.getElementById('m-item-title').textContent='Novo Item';
    Utils.openModal('modal-item');
  },

  editItem(id){
    const item=Store.getItems().find(i=>i.id===id); if(!item)return;
    Utils.fillSelect('m-item-cat', Store.getCategorias());
    Utils.fillSelect('m-item-dep', Store.getDepositos());
    document.getElementById('m-item-id').value      = item.id;
    document.getElementById('m-item-codigo').value  = item.codigo||'';
    document.getElementById('m-item-desc').value    = item.descricao;
    document.getElementById('m-item-cat').value     = item.categoria;
    document.getElementById('m-item-dep').value     = item.deposito;
    document.getElementById('m-item-qtd').value     = item.quantidade;
    document.getElementById('m-item-min').value     = item.minimo;
    document.getElementById('m-item-valor').value   = (item.valor||0).toFixed(2);
    document.getElementById('m-item-obs').value     = item.obs||'';
    document.getElementById('m-item-title').textContent='Editar Item';
    Utils.openModal('modal-item');
  },

  saveItem(){
    const id    = document.getElementById('m-item-id').value;
    const desc  = document.getElementById('m-item-desc').value.trim();
    const codigo= document.getElementById('m-item-codigo').value.trim().toUpperCase();
    if(!desc){ Utils.notify('Preencha a descrição','error'); return; }
    const items=Store.getItems();
    // Check codigo unique
    if(codigo && items.some(i=>i.codigo===codigo && String(i.id)!==id)){ Utils.notify('Código já cadastrado em outro item','error'); return; }
    const obj={
      id: id?parseInt(id):Store.nextId(items),
      codigo, descricao:desc,
      categoria:  document.getElementById('m-item-cat').value,
      deposito:   document.getElementById('m-item-dep').value,
      quantidade: parseInt(document.getElementById('m-item-qtd').value)||0,
      minimo:     parseInt(document.getElementById('m-item-min').value)||5,
      valor:      parseFloat(document.getElementById('m-item-valor').value)||0,
      obs:        document.getElementById('m-item-obs').value.trim(),
    };
    if(id){ const idx=items.findIndex(i=>i.id===obj.id); items[idx]=obj; }
    else   { items.push(obj); }
    Store.setItems(items);
    Utils.closeModal('modal-item');
    App.refreshCurrentPage();
    App.addActivity(`<strong>${Auth.currentUser?.nome||'Admin'}</strong>: ${id?'Editou':'Criou'} item "${obj.descricao}"`, id?'blue':'green');
    Utils.notify(id?'Item atualizado!':'Item criado!');
  },

  deleteItem(id){
    const item=Store.getItems().find(i=>i.id===id); if(!item)return;
    if(!confirm(`Excluir "${item.descricao}"?`))return;
    Store.setItems(Store.getItems().filter(i=>i.id!==id));
    App.refreshCurrentPage(); Utils.notify('Item excluído!');
  },

  // ---- ENTRADA ----
  openEntrada(){
    Utils.fillItemSelect('m-ent-item', Store.getItems());
    document.getElementById('m-ent-qtd').value  = '1';
    document.getElementById('m-ent-data').value = Utils.today();
    document.getElementById('m-ent-resp').value = '';
    document.getElementById('m-ent-obs').value  = '';
    Utils.openModal('modal-entrada');
  },

  openEntradaFor(itemId){ this.openEntrada(); document.getElementById('m-ent-item').value=itemId; },

  saveEntrada(){
    const itemId=parseInt(document.getElementById('m-ent-item').value);
    const qtd   =parseInt(document.getElementById('m-ent-qtd').value);
    if(!itemId){ Utils.notify('Selecione um item','error'); return; }
    if(qtd<1)  { Utils.notify('Quantidade inválida','error'); return; }
    const items=Store.getItems(), item=items.find(i=>i.id===itemId); if(!item)return;
    const entrada={
      id:Store.nextId(Store.getEntradas()), itemId, itemNome:item.descricao,
      itemCodigo:item.codigo||'', qtd, valorUnit:item.valor||0,
      data:document.getElementById('m-ent-data').value,
      resp:document.getElementById('m-ent-resp').value.trim(),
      obs: document.getElementById('m-ent-obs').value.trim(),
    };
    item.quantidade+=qtd;
    Store.setItems(items); Store.setEntradas([...Store.getEntradas(),entrada]);
    App.addActivity(`<strong>${entrada.resp||Auth.currentUser?.nome||'Admin'}</strong>: Entrada de ${item.descricao} (+${qtd})`,'green');
    Utils.closeModal('modal-entrada'); App.refreshCurrentPage();
    Utils.notify(`Entrada de ${qtd} unidade(s) registrada!`);
  },

  // ---- SAÍDA ----
  openSaida(){
    Utils.fillItemSelect('m-sai-item', Store.getItems());
    this._setupFuncSearch();
    document.getElementById('m-sai-qtd').value  = '1';
    document.getElementById('m-sai-data').value = Utils.today();
    document.getElementById('m-sai-obs').value  = '';
    document.getElementById('m-sai-info').textContent='';
    Utils.openModal('modal-saida');
  },

  openSaidaFor(itemId){ this.openSaida(); document.getElementById('m-sai-item').value=itemId; this.updateSaidaMax(); },

  _setupFuncSearch(){
    const input  = document.getElementById('m-sai-func-search');
    const results= document.getElementById('m-sai-func-results');
    const hiddenId   = document.getElementById('m-sai-func-id');
    const hiddenNome = document.getElementById('m-sai-func-nome');
    const hiddenSetor= document.getElementById('m-sai-func-setor');
    const tag        = document.getElementById('m-sai-func-tag');
    if(!input)return;
    // Reset
    input.value=''; hiddenId.value=''; hiddenNome.value=''; hiddenSetor.value='';
    tag.style.display='none'; results.style.display='none'; results.innerHTML='';

    input.oninput = ()=>{
      const q=input.value.toLowerCase().trim();
      if(!q){ results.style.display='none'; return; }
      const fns=Store.getFuncionarios().filter(f=>f.ativo!==false&&(f.nome.toLowerCase().includes(q)||f.setor.toLowerCase().includes(q)||(f.cargo||'').toLowerCase().includes(q)));
      if(fns.length===0){ results.innerHTML='<div style="padding:10px 14px;font-size:13px;color:var(--text-3)">Nenhum funcionário encontrado</div>'; results.style.display='block'; return; }
      results.innerHTML=fns.map(f=>`
        <div onclick="Modals._selectFunc(${f.id})" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);transition:background .15s;" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
          ${Utils.avatarHtml(f.nome,'sm')}
          <div><div style="font-size:13px;font-weight:500">${f.nome}</div><div style="font-size:11.5px;color:var(--text-3)">${f.setor} · ${f.cargo||'—'}</div></div>
        </div>`).join('');
      results.style.display='block';
    };
    // Close on outside click
    setTimeout(()=>{
      document.addEventListener('click', function handler(e){
        if(!results.contains(e.target)&&e.target!==input){ results.style.display='none'; document.removeEventListener('click',handler); }
      });
    },100);
  },

  _selectFunc(id){
    const fn=Store.getFuncionarios().find(f=>f.id===id); if(!fn)return;
    document.getElementById('m-sai-func-id').value   = fn.id;
    document.getElementById('m-sai-func-nome').value = fn.nome;
    document.getElementById('m-sai-func-setor').value= fn.setor;
    document.getElementById('m-sai-func-search').value='';
    document.getElementById('m-sai-func-results').style.display='none';
    const tag=document.getElementById('m-sai-func-tag');
    tag.innerHTML=`${Utils.avatarHtml(fn.nome,'sm')} <div><div style="font-size:13px;font-weight:500">${fn.nome}</div><div style="font-size:11px;color:var(--text-3)">${fn.setor} · ${fn.cargo||'—'}</div></div><button onclick="Modals._clearFunc()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--text-3);font-size:16px;padding:0 4px;">✕</button>`;
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
    const itemId=parseInt(document.getElementById('m-sai-item').value);
    const item=Store.getItems().find(i=>i.id===itemId);
    const info=document.getElementById('m-sai-info');
    if(item){ document.getElementById('m-sai-qtd').max=item.quantidade; if(info)info.textContent=`Disponível: ${item.quantidade} un. · R$ ${(item.valor||0).toFixed(2)} unit.`; }
    else if(info){ info.textContent=''; }
  },

  saveSaida(){
    const itemId =parseInt(document.getElementById('m-sai-item').value);
    const qtd    =parseInt(document.getElementById('m-sai-qtd').value);
    const funcId =parseInt(document.getElementById('m-sai-func-id').value)||null;
    const funcNome=document.getElementById('m-sai-func-nome').value.trim();
    const funcSetor=document.getElementById('m-sai-func-setor').value.trim();
    if(!itemId)              { Utils.notify('Selecione um item','error'); return; }
    if(qtd<1)                { Utils.notify('Quantidade inválida','error'); return; }
    if(!funcNome)            { Utils.notify('Selecione o funcionário','error'); return; }
    const items=Store.getItems(), item=items.find(i=>i.id===itemId); if(!item)return;
    if(item.quantidade<qtd)  { Utils.notify('Quantidade insuficiente!','error'); return; }
    const saida={
      id:Store.nextId(Store.getSaidas()), itemId, itemNome:item.descricao,
      itemCodigo:item.codigo||'', qtd, valorUnit:item.valor||0,
      data:document.getElementById('m-sai-data').value,
      funcId, funcNome, setor:funcSetor,
      obs:document.getElementById('m-sai-obs').value.trim(),
    };
    item.quantidade-=qtd;
    Store.setItems(items); Store.setSaidas([...Store.getSaidas(),saida]);
    App.addActivity(`<strong>${funcNome}</strong>: Retirada de ${item.descricao} (−${qtd}) — ${funcSetor}`,'red');
    Utils.closeModal('modal-saida'); App.refreshCurrentPage();
    if(item.quantidade<item.minimo) Utils.notify(`⚠ ${item.descricao} abaixo do mínimo!`,'error');
    else Utils.notify(`Saída registrada!`);
    // Auto-print term
    setTimeout(()=>{ if(confirm('Imprimir termo de retirada?')) Impressao.termoRetirada(saida.id); },300);
  },

  // ---- ACESSO ----
  openAcesso(){
    document.getElementById('m-ac-nome').value ='';
    document.getElementById('m-ac-hora').value =Utils.nowTime();
    document.getElementById('m-ac-data').value =Utils.today();
    document.getElementById('m-ac-cargo').value='';
    document.getElementById('m-ac-tipo').value ='Entrada';
    Utils.openModal('modal-acesso');
  },

  saveAcesso(){
    const nome=document.getElementById('m-ac-nome').value.trim();
    if(!nome){ Utils.notify('Informe o nome','error'); return; }
    const ac={ id:Store.nextId(Store.getAcessos()), nome, tipo:document.getElementById('m-ac-tipo').value, hora:document.getElementById('m-ac-hora').value, data:document.getElementById('m-ac-data').value, cargo:document.getElementById('m-ac-cargo').value.trim() };
    Store.setAcessos([ac,...Store.getAcessos()]);
    App.addActivity(`<strong>${ac.nome}</strong>: ${ac.tipo} — ${ac.hora}`,ac.tipo==='Entrada'?'green':'red');
    Utils.closeModal('modal-acesso'); App.refreshCurrentPage();
    Utils.notify('Acesso registrado!');
  },

  // ---- FUNCIONÁRIO ----
  openNewFuncionario(){
    document.getElementById('m-func-id').value    ='';
    document.getElementById('m-func-nome').value  ='';
    document.getElementById('m-func-cargo').value ='';
    document.getElementById('m-func-ativo').checked=true;
    document.getElementById('m-func-title').textContent='Novo Funcionário';
    const setores=Store.getSetores();
    Utils.fillSelect('m-func-setor', setores);
    Utils.openModal('modal-funcionario');
  },

  editFuncionario(id){
    const fn=Store.getFuncionarios().find(f=>f.id===id); if(!fn)return;
    document.getElementById('m-func-id').value    =fn.id;
    document.getElementById('m-func-nome').value  =fn.nome;
    document.getElementById('m-func-cargo').value =fn.cargo||'';
    document.getElementById('m-func-ativo').checked=fn.ativo!==false;
    document.getElementById('m-func-title').textContent='Editar Funcionário';
    const setores=Store.getSetores();
    Utils.fillSelect('m-func-setor', setores);
    document.getElementById('m-func-setor').value=fn.setor;
    Utils.openModal('modal-funcionario');
  },

  saveFuncionario(){
    const id   =document.getElementById('m-func-id').value;
    const nome =document.getElementById('m-func-nome').value.trim();
    const setor=document.getElementById('m-func-setor').value;
    const cargo=document.getElementById('m-func-cargo').value.trim();
    const ativo=document.getElementById('m-func-ativo').checked;
    if(!nome){ Utils.notify('Informe o nome','error'); return; }
    const fns=Store.getFuncionarios();
    if(id){ const idx=fns.findIndex(f=>f.id===parseInt(id)); fns[idx]={...fns[idx],nome,setor,cargo,ativo}; }
    else   { fns.push({id:Store.nextId(fns),nome,setor,cargo,ativo:true}); }
    Store.setFuncionarios(fns);
    Utils.closeModal('modal-funcionario');
    PageFuncionarios.render();
    Utils.notify(id?'Funcionário atualizado!':'Funcionário cadastrado!');
  },

  // ---- USUÁRIO ----
  openNewUsuario(){
    ['m-usr-id','m-usr-nome','m-usr-email','m-usr-senha'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('m-usr-role').value='operador';
    document.getElementById('m-usr-ativo').checked=true;
    document.getElementById('m-usr-title').textContent='Novo Usuário';
    Utils.openModal('modal-usuario');
  },

  editUsuario(id){
    const u=Store.getUsers().find(x=>x.id===id); if(!u)return;
    document.getElementById('m-usr-id').value    =u.id;
    document.getElementById('m-usr-nome').value  =u.nome;
    document.getElementById('m-usr-email').value =u.email;
    document.getElementById('m-usr-senha').value ='';
    document.getElementById('m-usr-role').value  =u.role;
    document.getElementById('m-usr-ativo').checked=u.ativo!==false;
    document.getElementById('m-usr-title').textContent='Editar Usuário';
    Utils.openModal('modal-usuario');
  },

  saveUsuario(){
    const id   =document.getElementById('m-usr-id').value;
    const nome =document.getElementById('m-usr-nome').value.trim();
    const email=document.getElementById('m-usr-email').value.trim();
    const senha=document.getElementById('m-usr-senha').value.trim();
    const role =document.getElementById('m-usr-role').value;
    const ativo=document.getElementById('m-usr-ativo').checked;
    if(!nome||!email){ Utils.notify('Preencha nome e e-mail.','error'); return; }
    const users=Store.getUsers();
    if(!id&&users.find(u=>u.email===email)){ Utils.notify('E-mail já cadastrado.','error'); return; }
    if(id){ const idx=users.findIndex(u=>u.id===parseInt(id)); users[idx]={...users[idx],nome,email,role,ativo}; if(senha)users[idx].senha=senha; }
    else  { if(!senha){ Utils.notify('Informe uma senha.','error'); return; } users.push({id:Store.nextId(users),nome,email,senha,role,ativo:true}); }
    Store.setUsers(users); Utils.closeModal('modal-usuario');
    PageUsuarios.render(); Utils.notify(id?'Usuário atualizado!':'Usuário criado!');
  },
};

// Close modal on overlay click
document.addEventListener('click', e=>{ if(e.target.classList.contains('modal-overlay')) e.target.classList.remove('open'); });
