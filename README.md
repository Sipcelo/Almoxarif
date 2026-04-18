# Almoxarifado — Sistema de Gestão v2.0

Sistema completo de gestão de almoxarifado com tela de login, controle de estoque, entradas, saídas e controle de acesso.

---

## 📁 Estrutura de Arquivos

```
almoxarifado/
├── index.html              ← Arquivo principal (abrir no navegador)
├── README.md               ← Este arquivo
│
├── css/
│   ├── variables.css       ← Tokens de design e reset CSS
│   ├── components.css      ← Botões, badges, cards, tabelas, modais
│   ├── layout.css          ← Sidebar, topbar, shell do app
│   └── login.css           ← Tela de login
│
└── js/
    ├── data.js             ← Banco de dados (localStorage) e seed inicial
    ├── utils.js            ← Utilitários: datas, notificações, helpers
    ├── auth.js             ← Autenticação (login/logout/sessão)
    ├── modals.js           ← CRUD: salvar/editar/excluir via modais
    ├── app.js              ← Controlador principal, navegação, boot
    └── pages/
        ├── dashboard.js    ← Renderização do Dashboard
        └── pages.js        ← Estoque, Entradas, Saídas, Acesso, Config, Relatórios
```

---

## 🚀 Instalação e Uso

### Opção 1 — Uso direto (mais simples)
1. Extraia a pasta `almoxarifado/` em qualquer local
2. Abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox)
3. Faça login com as credenciais abaixo

### Opção 2 — Servidor local (recomendado)
Para evitar restrições de CORS ao carregar arquivos JS externos:

**Com Python:**
```bash
cd almoxarifado
python3 -m http.server 8080
# Acesse: http://localhost:8080
```

**Com Node.js (npx):**
```bash
cd almoxarifado
npx serve .
# Acesse o endereço exibido no terminal
```

**Com VS Code:**
Instale a extensão "Live Server" e clique em "Go Live" com o arquivo `index.html` aberto.

---

## 🔐 Credenciais de Acesso

| Perfil       | E-mail                        | Senha      |
|--------------|-------------------------------|------------|
| Administrador | admin@almoxarifado.com       | admin123   |
| Operador      | op@almoxarifado.com          | op123      |

---

## 💾 Armazenamento de Dados

Todos os dados são armazenados no **localStorage** do navegador.  
- Os dados **persistem** ao fechar e reabrir o navegador
- Os dados são **por navegador** (não sincronizam entre computadores)
- Use **Configurações → Exportar dados (JSON)** para fazer backup
- Use **Configurações → Apagar todos os dados** para resetar

---

## ✨ Funcionalidades

- ✅ Tela de login com autenticação
- ✅ Dashboard com estatísticas em tempo real
- ✅ Cadastro e gestão de itens em estoque
- ✅ Registro de entradas com responsável e observação
- ✅ Registro de saídas com validação de quantidade
- ✅ Alerta visual quando item abaixo do mínimo
- ✅ Controle de acesso (entrada/saída de pessoas)
- ✅ Relatórios e histórico de movimentações
- ✅ Categorias e depósitos configuráveis
- ✅ Exportação de dados em JSON
- ✅ Pesquisa em todas as telas
- ✅ Notificações de sucesso/erro

---

## 🛠️ Tecnologias

- HTML5 + CSS3 + JavaScript puro (sem frameworks)
- Font: DM Sans + DM Mono (Google Fonts)
- Armazenamento: localStorage (navegador)
- Sem dependências externas além das fontes
