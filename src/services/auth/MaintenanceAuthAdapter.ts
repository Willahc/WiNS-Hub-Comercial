import axios from 'axios';
import type { AuthAdapter, AuthSession } from './AuthAdapter';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Dedicated, un-intercepted HTTP client for authentication session validation
const authClient = axios.create({
  baseURL: API_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export class MaintenanceAuthAdapter implements AuthAdapter {
  private session: AuthSession | null = null;
  private ready = false;

  constructor() {
    this.ready = true;
  }

  async getSession(): Promise<AuthSession | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await authClient.get('/auth/session', {
        signal: controller.signal,
        timeout: 8000,
        headers: {
          'Accept': 'application/json'
        }
      });

      // Reject non-JSON responses (e.g. Nginx HTTP 200 with HTML page)
      const contentType = res.headers['content-type'] || '';
      if (!contentType.includes('application/json')) {
        console.error('[MaintenanceAuthAdapter] Resposta inválida (não-JSON):', contentType);
        this.session = null;
        return null;
      }

      const data = res.data;
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        console.error('[MaintenanceAuthAdapter] Corpo da resposta JSON malformado');
        this.session = null;
        return null;
      }

      if (data.authenticated !== true) {
        this.session = null;
        return null;
      }

      // Strict backend schema validation
      if (!data.username || typeof data.username !== 'string') {
        console.error('[MaintenanceAuthAdapter] Campo username ausente ou inválido no backend');
        this.session = null;
        return null;
      }

      if (!Array.isArray(data.roles) || !Array.isArray(data.permissions)) {
        console.error('[MaintenanceAuthAdapter] Campos roles ou permissions ausentes ou malformatados no backend');
        this.session = null;
        return null;
      }

      this.session = {
        userId: data.username,
        username: data.username,
        displayName: data.displayName || data.username,
        email: data.email || `${data.username}@winshubcomercial.com.br`,
        roles: data.roles,
        permissions: data.permissions,
        authenticated: true,
        expiresAt: null,
        authMode: 'maintenance'
      };

      return this.session;
    } catch (err: any) {
      this.session = null;
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        console.warn('[MaintenanceAuthAdapter] Timeout de 8s excedido ao consultar /auth/session.');
      } else {
        console.warn('[MaintenanceAuthAdapter] Falha de autenticação:', err?.message || err);
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async login(): Promise<void> {
    window.location.reload();
  }

  async logout(): Promise<void> {
    this.session = null;
    try {
      await authClient.post('/auth/logout', {}, { timeout: 3000 });
    } catch {}
    window.location.href = '/logout-maintenance.html';
  }

  async refresh(): Promise<boolean> {
    const s = await this.getSession();
    return s !== null && s.authenticated === true;
  }

  hasRole(role: string): boolean {
    if (!this.session) return false;
    return this.session.roles.includes(role) || this.session.roles.includes('admin');
  }

  hasPermission(permission: string): boolean {
    if (!this.session) return false;
    return this.session.permissions.includes(permission) || this.session.permissions.includes('all');
  }

  isReady(): boolean {
    return this.ready;
  }
}
