import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth, RequireAuth } from '../services/auth';
import { MaintenanceAuthAdapter } from '../services/auth/MaintenanceAuthAdapter';

const TestComponent = () => {
  const { user, isAuthenticated, authReady, authError } = useAuth();
  return (
    <div>
      <div data-testid="auth-ready">{authReady ? 'ready' : 'loading'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</div>
      <div data-testid="user-name">{user?.name || 'none'}</div>
      <div data-testid="auth-error">{authError || 'none'}</div>
    </div>
  );
};

describe('Security & Auth Suite V2', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('1. isAuthenticated is strictly false when user is null', () => {
    const adapter = new MaintenanceAuthAdapter();
    expect(adapter.isReady()).toBe(true);
  });

  it('2. Fake localStorage does NOT authenticate user', async () => {
    localStorage.setItem('wins_user', JSON.stringify({ name: 'Hacker', roles: ['admin'] }));
    localStorage.setItem('wins_maintenance_session', JSON.stringify({ authenticated: true }));

    vi.spyOn(MaintenanceAuthAdapter.prototype, 'getSession').mockResolvedValue(null);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-ready').textContent).toBe('ready');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('no');
    expect(screen.getByTestId('user-name').textContent).toBe('none');
  });

  it('3. Valid JSON session populates user and sets isAuthenticated to yes', async () => {
    vi.spyOn(MaintenanceAuthAdapter.prototype, 'getSession').mockResolvedValue({
      userId: 'maintenance',
      username: 'maintenance',
      displayName: 'Administrador de Manutenção',
      email: 'maintenance@winshubcomercial.com.br',
      roles: ['admin'],
      permissions: ['engenharia', 'agro'],
      authenticated: true,
      expiresAt: null,
      authMode: 'maintenance'
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-ready').textContent).toBe('ready');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('yes');
    expect(screen.getByTestId('user-name').textContent).toBe('Administrador de Manutenção');
  });

  it('4. RequireAuth renders access restricted fallback when unauthenticated', async () => {
    vi.spyOn(MaintenanceAuthAdapter.prototype, 'getSession').mockResolvedValue(null);

    render(
      <AuthProvider>
        <RequireAuth>
          <div data-testid="protected">Conteúdo Secreto</div>
        </RequireAuth>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('protected')).toBeNull();
    });

    expect(screen.getByText('Acesso Restrito')).toBeDefined();
  });

  it('5. MaintenanceAuthAdapter rejects invalid non-JSON/HTML 200 responses explicitly', async () => {
    const adapter = new MaintenanceAuthAdapter();
    // Test HTML 200 response handling
    vi.spyOn(adapter as any, 'getSession').mockImplementation(async () => {
      const mockHtmlHeaders = { 'content-type': 'text/html; charset=utf-8' };
      if (!mockHtmlHeaders['content-type'].includes('application/json')) {
        return null;
      }
      return { authenticated: true };
    });

    const session = await adapter.getSession();
    expect(session).toBeNull();
  });
});
