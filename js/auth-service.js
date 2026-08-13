/**
 * AuthService.js
 * Responsabilidad única: autenticación y sesiones vía Supabase Auth
 */

export class AuthService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.currentUser = null;
  }

  async getSession() {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session) {
        this.currentUser = session.user;
        return this.currentUser;
      }
      return null;
    } catch (err) {
      console.warn('⚠️ Error obteniendo sesión:', err.message);
      return null;
    }
  }

  async signInWithPassword(email, password) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      this.currentUser = data.user;
      console.log('✅ Autenticado como:', this.currentUser.email);
      return this.currentUser;
    } catch (err) {
      console.warn('⚠️ Error en login:', err.message);
      throw err;
    }
  }

  async logout() {
    try {
      await this.supabase.auth.signOut();
      this.currentUser = null;
      console.log('✅ Sesión cerrada');
    } catch (err) {
      console.warn('⚠️ Error en logout:', err.message);
    }
  }

  getCurrentUser()  { return this.currentUser; }
  isAuthenticated() { return this.currentUser !== null; }
}
