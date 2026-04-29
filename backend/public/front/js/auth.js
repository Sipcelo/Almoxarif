/* ============================================================
   ALMOXARIFADO — Auth Module v4 (SDD-004 PR-2)
   Server-side authentication via apiClient.
   Frontend keeps only the in-memory currentUser + can()/isAdmin()
   helpers. Session lives server-side (cookie almox_sid).
   ============================================================ */

const Auth = {
  currentUser: null,

  async init() {
    try {
      const res = await apiClient.auth.me();
      const user = res && res.user ? res.user : null;
      if (!user || user.ativo === false) {
        this.currentUser = null;
        return false;
      }
      this.currentUser = this._toSession(user);
      return true;
    } catch (_err) {
      this.currentUser = null;
      return false;
    }
  },

  async login(email, senha) {
    try {
      const res = await apiClient.auth.login(email, senha);
      const user = res && res.user ? res.user : null;
      if (!user) return { ok: false, code: "UNKNOWN", message: "Resposta inválida do servidor." };
      this.currentUser = this._toSession(user);
      return { ok: true };
    } catch (err) {
      const code = err && err.code ? err.code : "UNKNOWN";
      const message = err && err.message ? err.message : "Erro inesperado.";
      return { ok: false, code, message };
    }
  },

  async logout() {
    try {
      await apiClient.auth.logout();
    } catch (_err) {
      // Mesmo com falha, limpa a sessão local e leva para login.
    }
    this.currentUser = null;
    App.showLoginPage();
  },

  _toSession(u) {
    return { id: u.id, nome: u.nome, email: u.email, role: u.role };
  },

  can(page) {
    const role = (this.currentUser && this.currentUser.role) || "visitante";
    return (PERMISSIONS[role] || []).includes(page);
  },

  isAdmin() {
    return !!(this.currentUser && this.currentUser.role === "admin");
  },
};
