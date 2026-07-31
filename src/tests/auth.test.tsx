import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth, RequireAuth } from '../services/auth';

const TestComponent = () => {
  const { user, isAuthenticated, authReady } = useAuth();
  return (
    <div>
      <div data-testid="auth-ready">{authReady ? 'ready' : 'loading'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</div>
      <div data-testid="user-name">{user?.name || 'none'}</div>
    </div>
  );
};

describe('AuthProvider & MaintenanceAuthAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders children and completes authentication ready state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-ready').textContent).toBe('ready');
    });
  });

  it('renders protected content when authenticated', async () => {
    localStorage.setItem('wins_maintenance_session', JSON.stringify({
      userId: 'test_admin',
      username: 'test_admin',
      displayName: 'Administrador Teste',
      email: 'admin@test.com',
      roles: ['maintenance_admin'],
      permissions: ['all'],
      authenticated: true,
      expiresAt: null,
      authMode: 'maintenance'
    }));

    render(
      <AuthProvider>
        <RequireAuth>
          <div data-testid="protected-content">Área Protegida</div>
        </RequireAuth>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeDefined();
    });
  });
});
