/* ============================================================
   ALMOXARIFADO — Auth Module v3
   ============================================================ */

const Auth = {
  currentUser: null,

  init() {
    const saved = Store.getSession();
    if (saved) {
      // Refresh from store (role/ativo may have changed)
      const users = Store.getUsers();
      const fresh = users.find(u => u.id === saved.id && u.ativo !== false);
      if (fresh) {
        this.currentUser = this._toSession(fresh);
        Store.setSession(this.currentUser);
        return true;
      }
      Store.clearSession();
    }
    return false;
  },

  login(email, senha) {
    const users = Store.getUsers();
    const user  = users.find(u => u.email === email && u.senha === senha && u.ativo !== false);
    if (!user) return false;
    this.currentUser = this._toSession(user);
    Store.setSession(this.currentUser);
    return true;
  },

  logout() {
    Store.clearSession();
    this.currentUser = null;
    App.showLoginPage();
  },

  _toSession(u) {
    return { id:u.id, nome:u.nome, email:u.email, role:u.role };
  },

  can(page) {
    const role = this.currentUser?.role || 'visitante';
    return (PERMISSIONS[role] || []).includes(page);
  },

  isAdmin() { return this.currentUser?.role === 'admin'; },
};
