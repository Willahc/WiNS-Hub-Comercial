/**
 * AuthAdapter — Interface canônica de autenticação corporativa WiNS Hub.
 */

export interface AuthSession {
  userId: string;
  username: string;
  displayName: string;
  email: string;
  roles: string[];
  permissions: string[];
  authenticated: boolean;
  expiresAt: number | null;
  authMode: 'keycloak' | 'maintenance' | 'oidc' | 'none';
}

export interface AuthAdapter {
  getSession(): Promise<AuthSession | null>;
  login(): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<boolean>;
  hasRole(role: string): boolean;
  hasPermission(permission: string): boolean;
  isReady(): boolean;
}
