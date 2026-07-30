import React, { createContext, useContext, useState, useEffect } from 'react';
import Keycloak from 'keycloak-js';
import type { User, Role, Permission } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  authReady: boolean;
  login: () => void;
  logout: () => void;
  hasRole: (role: Role) => boolean;
  hasPermission: (permission: Permission) => boolean;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const isKeycloakEnabled = import.meta.env.VITE_AUTH_PROVIDER === 'keycloak' || !!import.meta.env.VITE_KEYCLOAK_URL;

let keycloakInstance: Keycloak | null = null;
let tokenRefreshPromise: Promise<string | undefined> | null = null;

if (isKeycloakEnabled) {
  const url = import.meta.env.VITE_KEYCLOAK_URL || 'https://winshubcomercial.com.br:18443/auth';
  const realm = import.meta.env.VITE_KEYCLOAK_REALM || 'wins-hub-staging';
  const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'wins-hub-spa';

  keycloakInstance = new Keycloak({ url, realm, clientId });
}

export const getAccessToken = (): string | undefined => keycloakInstance?.token;

export const ensureValidToken = async (): Promise<string | undefined> => {
  if (!keycloakInstance || !keycloakInstance.authenticated) {
    return keycloakInstance?.token;
  }

  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  tokenRefreshPromise = (async () => {
    try {
      // Refresh token if expiring within 30 seconds
      const refreshed = await keycloakInstance.updateToken(30);
      if (refreshed) {
        console.log('[Keycloak] Token de acesso renovado proativamente');
      }
      return keycloakInstance.token;
    } catch (err) {
      console.error('[Keycloak] Falha na renovação proativa do token:', err);
      return keycloakInstance.token;
    } finally {
      tokenRefreshPromise = null;
    }
  })();

  return tokenRefreshPromise;
};

export const forceTokenRefresh = async (): Promise<string | undefined> => {
  if (!keycloakInstance || !keycloakInstance.authenticated) return undefined;
  try {
    await keycloakInstance.updateToken(-1);
    return keycloakInstance.token;
  } catch (err) {
    console.error('[Keycloak] Falha ao forçar refresh do token:', err);
    return undefined;
  }
};

let initStarted = false;

const savedUserInit = typeof window !== 'undefined' ? localStorage.getItem('wins_user') : null;
let parsedUserInit: User | null = null;
if (savedUserInit) {
  try { parsedUserInit = JSON.parse(savedUserInit); } catch (e) {}
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(parsedUserInit);
  const [authReady, setAuthReady] = useState<boolean>(!!parsedUserInit || !isKeycloakEnabled);

  const updateUserFromToken = (tokenParsed: any) => {
    if (!tokenParsed) return;
    const realmRoles: string[] = tokenParsed.realm_access?.roles || [];
    const clientRoles: Role[] = tokenParsed.resource_access?.[keycloakInstance?.clientId || '']?.roles || [];

    let profileRole: Role = 'viewer';
    if (clientRoles.includes('admin')) profileRole = 'admin';
    else if (clientRoles.includes('gestor')) profileRole = 'gestor';
    else if (realmRoles.includes('analista') || clientRoles.includes('analista')) profileRole = 'analista';
    else if (realmRoles.includes('comercial') || clientRoles.includes('comercial')) profileRole = 'comercial';

    const permissions: Permission[] = [];
    if (realmRoles.includes('engenharia')) permissions.push('engenharia');
    if (realmRoles.includes('empresa360')) permissions.push('empresa360');
    if (realmRoles.includes('comercial')) permissions.push('comercial');
    if (realmRoles.includes('logistica')) permissions.push('logistica');
    if (realmRoles.includes('agro')) permissions.push('agro');
    if (realmRoles.includes('saude')) permissions.push('saude');
    if (realmRoles.includes('relatorios')) permissions.push('relatorios');

    setUser({
      id: tokenParsed.sub || '',
      name: tokenParsed.name || tokenParsed.preferred_username || 'Usuário Keycloak',
      email: tokenParsed.email || '',
      roles: [profileRole],
      permissions
    });
  };

  useEffect(() => {
    // In unit test or local saved session environment, restore user from localStorage immediately
    const savedSession = typeof window !== 'undefined' ? localStorage.getItem('wins_user') : null;
    if (savedSession) {
      try {
        setUser(JSON.parse(savedSession));
        setAuthReady(true);
        return;
      } catch (e) {}
    }

    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
      setAuthReady(true);
      return;
    }

    if (keycloakInstance && !initStarted && !(keycloakInstance as any).didInitialize) {
      initStarted = true;
      keycloakInstance
        .init({
          onLoad: 'check-sso',
          pkceMethod: 'S256',
          checkLoginIframe: false,
          silentCheckSsoRedirectUri: window.location.origin + `${import.meta.env.BASE_URL}silent-check-sso.html`
        })
        .then((authenticated) => {
          if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
            try {
              const u = new URL(window.location.href);
              let mod = false;
              ['code', 'state', 'session_state', 'iss'].forEach((p) => {
                if (u.searchParams.has(p)) { u.searchParams.delete(p); mod = true; }
              });
              if (u.hash) {
                let h = u.hash.substring(1);
                ['code', 'state', 'session_state', 'iss'].forEach((p) => {
                  if (h.includes(p + '=')) {
                    const sp = new URLSearchParams(h);
                    sp.delete(p);
                    h = sp.toString();
                    mod = true;
                  }
                });
                u.hash = h ? '#' + h : '';
              }
              if (mod) {
                const cleanUrl = u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + u.hash;
                window.history.replaceState(null, document.title, cleanUrl);
              }
            } catch (e) {}
          }
          if (authenticated && keycloakInstance?.tokenParsed) {
            updateUserFromToken(keycloakInstance.tokenParsed);
          } else {
            const saved = localStorage.getItem('wins_user');
            if (saved) {
              try { setUser(JSON.parse(saved)); } catch (e) {}
            }
          }
          setAuthReady(true);
        })
        .catch((err) => {
          console.error('[Keycloak] Erro na inicialização SSO:', err);
          const saved = localStorage.getItem('wins_user');
          if (saved) {
            try { setUser(JSON.parse(saved)); } catch (e) {}
          }
          setAuthReady(true);
        });

      keycloakInstance.onTokenExpired = () => {
        console.log('[Keycloak] Token expirado, renovando automaticamente...');
        keycloakInstance
          ?.updateToken(30)
          .then((refreshed) => {
            if (refreshed && keycloakInstance?.tokenParsed) {
              updateUserFromToken(keycloakInstance.tokenParsed);
            }
          })
          .catch((err) => {
            console.error('[Keycloak] Falha ao renovar token de acesso:', err);
            setUser(null);
          });
      };
    } else if (!keycloakInstance) {
      setAuthReady(true);
    }
  }, []);

  const login = () => {
    if (keycloakInstance) {
      keycloakInstance.login({
        redirectUri: window.location.origin + import.meta.env.BASE_URL + 'engenharia'
      });
    }
  };

  const logout = () => {
    setUser(null);
    if (keycloakInstance) {
      keycloakInstance.logout({
        redirectUri: window.location.origin + import.meta.env.BASE_URL
      });
    }
  };

  const hasRole = (role: Role): boolean => {
    if (!user) return false;
    return user.roles.includes(role);
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    return user.permissions.includes(permission);
  };

  const refreshSession = async (): Promise<boolean> => {
    if (keycloakInstance) {
      try {
        const refreshed = await keycloakInstance.updateToken(30);
        if (refreshed && keycloakInstance.tokenParsed) {
          updateUserFromToken(keycloakInstance.tokenParsed);
        }
        return true;
      } catch (err) {
        console.error('[Keycloak] Falha ao renovar sessão:', err);
        setUser(null);
        return false;
      }
    }
    return false;
  };

  // Skip Keycloak loading for review routes — they don't need SSO
  const isReviewRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/review/');
  if (!authReady && !isReviewRoute) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ marginBottom: '16px' }}></div>
          <p style={{ fontSize: '14px', fontWeight: 600 }}>Validando sessão corporativa SSO Keycloak...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        authReady,
        login,
        logout,
        hasRole,
        hasPermission,
        refreshSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};

export const RequireAuth: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback
}) => {
  const { isAuthenticated, authReady } = useAuth();
  
  if (!authReady) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ marginBottom: '16px' }}></div>
          <p style={{ fontSize: '14px', fontWeight: 600 }}>Validando sessão corporativa SSO Keycloak...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback ? <>{fallback}</> : (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-primary)' }}>
        <h2>Acesso Restrito</h2>
        <p>Você precisa estar autenticado via SSO para acessar esta área.</p>
      </div>
    );
  }
  
  return <>{children}</>;
};

export const RequireRole: React.FC<{ role: Role; children: React.ReactNode; fallback?: React.ReactNode }> = ({
  role,
  children,
  fallback
}) => {
  const { hasRole } = useAuth();
  
  if (!hasRole(role)) {
    return fallback ? <>{fallback}</> : (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-primary)' }}>
        <h2>Acesso Negado</h2>
        <p>Seu perfil de acesso não possui a permissão requerida ({role.toUpperCase()}).</p>
      </div>
    );
  }
  
  return <>{children}</>;
};
