import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { User, Role, Permission } from '../types';
import type { AuthAdapter, AuthSession } from './auth/AuthAdapter';
import { MaintenanceAuthAdapter } from './auth/MaintenanceAuthAdapter';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  authReady: boolean;
  authError: string | null;
  login: () => void;
  logout: () => void;
  hasRole: (role: Role) => boolean;
  hasPermission: (permission: Permission) => boolean;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

let authAdapter: AuthAdapter | null = null;

function getAdapter(): AuthAdapter {
  if (!authAdapter) {
    authAdapter = new MaintenanceAuthAdapter();
  }
  return authAdapter;
}

export const getAccessToken = (): string | undefined => undefined;

export const ensureValidToken = async (): Promise<string | undefined> => {
  return '';
};

export const forceTokenRefresh = async (): Promise<string | undefined> => {
  return '';
};

function sessionToUser(session: AuthSession): User {
  let profileRole: Role = 'viewer';
  if (session.roles.includes('admin') || session.roles.includes('maintenance_admin')) profileRole = 'admin';
  else if (session.roles.includes('gestor')) profileRole = 'gestor';
  else if (session.roles.includes('analista')) profileRole = 'analista';
  else if (session.roles.includes('comercial')) profileRole = 'comercial';

  return {
    id: session.userId,
    name: session.displayName || session.username,
    email: session.email || '',
    roles: [profileRole],
    permissions: session.permissions as Permission[],
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const initAuth = useCallback(() => {
    if (!isMounted.current) return;
    setInitializing(true);
    setAuthError(null);

    const adapter = getAdapter();
    adapter.getSession()
      .then((session) => {
        if (!isMounted.current) return;
        if (session && session.authenticated === true) {
          const u = sessionToUser(session);
          setUser(u);
          setAuthError(null);
        } else {
          setUser(null);
        }
        setAuthReady(true);
        setInitializing(false);
      })
      .catch((err) => {
        if (!isMounted.current) return;
        setUser(null);
        setAuthError(err?.message || 'Falha de comunicação durante verificação de acesso.');
        setAuthReady(true);
        setInitializing(false);
      });
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = useCallback(async () => {
    const adapter = getAdapter();
    await adapter.login();
  }, []);

  const logout = useCallback(async () => {
    const adapter = getAdapter();
    if (isMounted.current) {
      setUser(null);
    }
    await adapter.logout();
  }, []);

  const hasRole = useCallback((role: Role): boolean => {
    if (!user) return false;
    const adapter = getAdapter();
    return adapter.hasRole(role);
  }, [user]);

  const hasPermission = useCallback((permission: Permission): boolean => {
    if (!user) return false;
    return user.permissions.includes(permission) || user.permissions.includes('all' as Permission);
  }, [user]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const adapter = getAdapter();
    const ok = await adapter.refresh();
    if (!ok && isMounted.current) {
      setUser(null);
    }
    return ok;
  }, []);

  const isReviewRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/review/');

  if (initializing && !isReviewRoute) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ marginBottom: '16px' }} />
          <p style={{ fontSize: '14px', fontWeight: 600 }}>Verificando acesso...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, authReady, authError, login, logout, hasRole, hasPermission, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  return context;
};

export const RequireAuth: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ children, fallback }) => {
  const { isAuthenticated, authReady } = useAuth();
  if (!authReady) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
        <div className="spinner" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return fallback ? <>{fallback}</> : (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-primary)' }}>
        <h2>Acesso Restrito</h2>
        <p>Autenticação necessária para acessar esta área.</p>
      </div>
    );
  }
  return <>{children}</>;
};

export const RequireRole: React.FC<{ role: Role; children: React.ReactNode; fallback?: React.ReactNode }> = ({ role, children, fallback }) => {
  const { hasRole } = useAuth();
  if (!hasRole(role)) {
    return fallback ? <>{fallback}</> : (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-primary)' }}>
        <h2>Acesso Negado</h2>
        <p>Seu perfil não possui a permissão requerida ({role.toUpperCase()}).</p>
      </div>
    );
  }
  return <>{children}</>;
};
