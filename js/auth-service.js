/**
 * AuthService.js
 * Responsabilidad única: autenticación y sesiones
 */

import { AUTH_CONFIG } from './config.js';

export class AuthService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.currentUser = null;
  }

  /**
   * Obtiene la sesión actual si existe
   */
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

  /**
   * Login con email y contraseña
   */
  async signInWithPassword(email, password) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      this.currentUser = data.user;
      console.log('✅ Autenticado como:', this.currentUser.email);
      return this.currentUser;
    } catch (err) {
      console.warn('⚠️ Error en login:', err.message);
      throw err;
    }
  }

  /**
   * Login de desarrollo (para pruebas)
   */
  async devLogin() {
    return this.signInWithPassword(AUTH_CONFIG.devEmail, AUTH_CONFIG.devPassword);
  }

  /**
   * Logout
   */
  async logout() {
    try {
      await this.supabase.auth.signOut();
      this.currentUser = null;
      console.log('✅ Sesión cerrada');
    } catch (err) {
      console.warn('⚠️ Error en logout:', err.message);
    }
  }

  /**
   * Obtiene el usuario actual
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Verifica si hay usuario autenticado
   */
  isAuthenticated() {
    return this.currentUser !== null;
  }
}
