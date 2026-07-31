/**
 * MaintenanceAuthAdapter — Autenticação temporária via Nginx Basic Auth.
 */

import type { AuthAdapter, AuthSession } from './AuthAdapter';
import { httpClient } from '../http/client';

const SESSION_KEY = 'wins_maintenance_session';

export class MaintenanceAuthAdapter implements AuthAdapter {
  private session: AuthSession | null = null;
  private ready = false;

  constructor() {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        this.session = JSON.parse(saved);
      }
    } catch {}
    this.ready = true;
  }

  async getSession(): Promise<AuthSession | null> {
    if (this.session) return this.session;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const startTime = performance.now();
      const res = await httpClient.get('/auth/session', {
        signal: controller.signal,
        timeout: 8000
      });
      clearTimeout(timeoutId);

      const data = res.data;
      const duration = Math.round(performance.now() - startTime);

      if (data && (data.authenticated || data.auth_mode === 'maintenance' || data.username)) {
        const username = data.username || data.userId || 'maintenance_admin';
        this.session = {
          userId: username,
          username: username,
          displayName: data.displayName || username,
          email: data.email || `${username}@winshubcomercial.com.br`,
          roles: data.roles && data.roles.length > 0 ? data.roles : ['maintenance_admin', 'admin', 'gestor', 'analista', 'comercial'],
          permissions: data.permissions && data.permissions.length > 0 ? data.permissions : ['all'],
          authenticated: true,
          expiresAt: null,
          authMode: 'maintenance',
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
        return this.session;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
    }
    return null;
  }

  async login(): Promise<void> {
    window.location.reload();
  }

  async logout(): Promise<void> {
    this.session = null;
    localStorage.removeItem(SESSION_KEY);
    try {
      await httpClient.post('/auth/logout', {}, { timeout: 3000 });
    } catch {}
    window.location.reload();
  }

  async refresh(): Promise<boolean> {
    return this.session !== null;
  }

  hasRole(role: string): boolean {
    if (!this.session) return false;
    return this.session.roles.includes(role) || this.session.roles.includes('maintenance_admin') || this.session.roles.includes('admin');
  }

  hasPermission(permission: string): boolean {
    if (!this.session) return false;
    return this.session.permissions.includes(permission) || this.session.permissions.includes('all');
  }

  isReady(): boolean {
    return this.ready;
  }
}
