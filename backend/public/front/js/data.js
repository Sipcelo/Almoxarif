/* ============================================================
   Almox — Data Layer v4
   ============================================================ */

const DB = {
  get(key)      { try { return JSON.parse(localStorage.getItem('alm_' + key)); } catch { return null; } },
  set(key, val) { localStorage.setItem('alm_' + key, JSON.stringify(val)); return val; },
  clear()       { Object.keys(localStorage).filter(k => k.startsWith('alm_')).forEach(k => localStorage.removeItem(k)); }
};

const PERMISSIONS = {
  admin:    ['painel','estoque','entradas','saidas','relatorios','funcionarios','usuarios','configuracoes'],
  gerente:  ['painel','estoque','entradas','saidas','relatorios','funcionarios'],
  operador: ['painel','estoque','entradas','saidas'],
  visitante:['painel'],
};

const ROLE_LABELS = { admin:'Administrador', gerente:'Gerente', operador:'Operador', visitante:'Visitante' };

const USERS_DEFAULT = [
  { id:1, nome:'Administrador', email:'admin@almoxarifado.com', senha:'admin123', role:'admin',    ativo:true },
  { id:2, nome:'Operador',      email:'op@almoxarifado.com',   senha:'op123',    role:'operador', ativo:true },
];

const SETORES_DEFAULT = ['Administrativo','TI','Manutenção','Almoxarifado','RH','Financeiro','Operações'];

function daysAgo(n) { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().split('T')[0]; }
function today()    { return new Date().toISOString().split('T')[0]; }

const SEED = {
  categorias: ['Cabos','Informática','Papelaria','Limpeza','Ferramentas','Eletrônicos','EPI'],
  depositos:  ['Depósito 01','Depósito 02','Almoxarifado Central','Escritório'],
  setores: SETORES_DEFAULT,
  items: [
    {id:1, codigo:'CAB001', descricao:'Cabo USB para Impressora', categoria:'Cabos',      deposito:'Depósito 01',          quantidade:20, minimo:5,  valor:8.50,  obs:''},
    {id:2, codigo:'INF001', descricao:'Teclado Sem Fio',          categoria:'Informática', deposito:'Depósito 01',          quantidade:20, minimo:3,  valor:120.00,obs:'Logitech MK270'},
    {id:3, codigo:'CAB002', descricao:'Cabo HDMI 3 Metros',       categoria:'Cabos',       deposito:'Depósito 01',          quantidade:22, minimo:5,  valor:25.00, obs:''},
    {id:4, codigo:'INF002', descricao:'Mouse Sem Fio',             categoria:'Informática', deposito:'Depósito 01',          quantidade:18, minimo:5,  valor:65.00, obs:''},
    {id:5, codigo:'INF003', descricao:'HD Externo 1TB',            categoria:'Informática', deposito:'Depósito 01',          quantidade:28, minimo:2,  valor:320.00,obs:'Seagate'},
    {id:6, codigo:'PAP001', descricao:'Papel Sulfite A4',          categoria:'Papelaria',   deposito:'Almoxarifado Central', quantidade:150,minimo:20, valor:28.00, obs:'Resma 500 folhas'},
    {id:7, codigo:'PAP002', descricao:'Caneta Esferográfica',      categoria:'Papelaria',   deposito:'Almoxarifado Central', quantidade:80, minimo:10, valor:1.50,  obs:'Azul e preta'},
    {id:8, codigo:'LIM001', descricao:'Pano de Limpeza',           categoria:'Limpeza',     deposito:'Depósito 02',          quantidade:30, minimo:10, valor:5.00,  obs:''},
    {id:9, codigo:'INF004', descricao:'Pendrive 32GB',             categoria:'Informática', deposito:'Escritório',           quantidade:4,  minimo:5,  valor:45.00, obs:''},
  ],
  funcionarios: [
    {id:1, nome:'Elisa Gomes',      setor:'Administrativo', cargo:'Assistente',    ativo:true},
    {id:2, nome:'Daniel Santos',    setor:'TI',             cargo:'Técnico',       ativo:true},
    {id:3, nome:'Marina Rodrigues', setor:'Operações',      cargo:'Supervisora',   ativo:true},
    {id:4, nome:'Carlos Pereira',   setor:'Manutenção',     cargo:'Motorista',     ativo:true},
    {id:5, nome:'João Almeida',     setor:'Almoxarifado',   cargo:'Almoxarife',    ativo:true},
  ],
  entradas: [
    {id:1, itemId:5, itemNome:'HD Externo 1TB',           itemCodigo:'INF003', qtd:3,  valorUnit:320.00, data:daysAgo(2),  resp:'João Almeida',    obs:''},
    {id:2, itemId:6, itemNome:'Papel Sulfite A4',         itemCodigo:'PAP001', qtd:50, valorUnit:28.00,  data:daysAgo(1),  resp:'Elisa Gomes',     obs:'Caixa grande'},
    {id:3, itemId:1, itemNome:'Cabo USB para Impressora', itemCodigo:'CAB001', qtd:10, valorUnit:8.50,   data:daysAgo(5),  resp:'Carlos Pereira',  obs:''},
    {id:4, itemId:7, itemNome:'Caneta Esferográfica',     itemCodigo:'PAP002', qtd:30, valorUnit:1.50,   data:daysAgo(10), resp:'João Almeida',    obs:''},
  ],
  saidas: [
    {id:1, itemId:1, itemNome:'Cabo USB para Impressora', itemCodigo:'CAB001', qtd:2, valorUnit:8.50,  data:daysAgo(2),  funcId:4, funcNome:'Carlos Pereira',  setor:'Manutenção',     obs:'Setor TI'},
    {id:2, itemId:4, itemNome:'Mouse Sem Fio',            itemCodigo:'INF002', qtd:1, valorUnit:65.00, data:daysAgo(1),  funcId:2, funcNome:'Daniel Santos',   setor:'TI',             obs:''},
    {id:3, itemId:7, itemNome:'Caneta Esferográfica',     itemCodigo:'PAP002', qtd:5, valorUnit:1.50,  data:today(),     funcId:1, funcNome:'Elisa Gomes',     setor:'Administrativo', obs:'Reunião'},
    {id:4, itemId:6, itemNome:'Papel Sulfite A4',         itemCodigo:'PAP001', qtd:3, valorUnit:28.00, data:daysAgo(8),  funcId:3, funcNome:'Marina Rodrigues',setor:'Operações',      obs:''},
    {id:5, itemId:2, itemNome:'Teclado Sem Fio',          itemCodigo:'INF001', qtd:1, valorUnit:120.00,data:daysAgo(12), funcId:2, funcNome:'Daniel Santos',   setor:'TI',             obs:'Substituição'},
  ],
};

function initStore() {
  if (!DB.get('users'))        DB.set('users',        USERS_DEFAULT);
  if (!DB.get('items'))        DB.set('items',        SEED.items);
  if (!DB.get('entradas'))     DB.set('entradas',     SEED.entradas);
  if (!DB.get('saidas'))       DB.set('saidas',       SEED.saidas);
  if (!DB.get('categorias'))   DB.set('categorias',   SEED.categorias);
  if (!DB.get('depositos'))    DB.set('depositos',    SEED.depositos);
  if (!DB.get('funcionarios')) DB.set('funcionarios', SEED.funcionarios);
  if (!DB.get('setores'))      DB.set('setores',      SEED.setores);
}

const Store = {
  getUsers()        { return DB.get('users')        || []; },
  setUsers(v)       { return DB.set('users', v); },
  getItems()        { return DB.get('items')        || []; },
  setItems(v)       { return DB.set('items', v); },
  getEntradas()     { return DB.get('entradas')     || []; },
  setEntradas(v)    { return DB.set('entradas', v); },
  getSaidas()       { return DB.get('saidas')       || []; },
  setSaidas(v)      { return DB.set('saidas', v); },
  getCategorias()   { return DB.get('categorias')   || []; },
  setCategorias(v)  { return DB.set('categorias', v); },
  getDepositos()    { return DB.get('depositos')    || []; },
  setDepositos(v)   { return DB.set('depositos', v); },
  getFuncionarios() { return DB.get('funcionarios') || []; },
  setFuncionarios(v){ return DB.set('funcionarios', v); },
  getSetores()      { return DB.get('setores')      || SETORES_DEFAULT; },
  setSetores(v)     { return DB.set('setores', v); },
  setSession(u)     { sessionStorage.setItem('alm_user', JSON.stringify(u)); },
  getSession()      { try { return JSON.parse(sessionStorage.getItem('alm_user')); } catch { return null; } },
  clearSession()    { sessionStorage.removeItem('alm_user'); },
  nextId(arr)       { return arr.length === 0 ? 1 : Math.max(...arr.map(x => x.id)) + 1; },
  clearAll()        { DB.clear(); initStore(); },
};
