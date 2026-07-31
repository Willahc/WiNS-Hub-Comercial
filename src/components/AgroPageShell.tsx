import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, RefreshCw, Inbox, Loader2 } from 'lucide-react';
import { DesktopSidebar, MobileSidebarContent } from './AppSidebar';

interface AgroPageShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: boolean;
  emptyMessage?: string;
  backTo?: string;
  backLabel?: string;
}

/**
 * Shell padronizado para todos os submódulos da suíte WiNS Hub Agro.
 * Inclui o menu lateral (DesktopSidebar & MobileSidebarContent), cabeçalho com navegação,
 * estados de carregamento, erros e lista vazia com design de alta fidelidade.
 */
export default function AgroPageShell({
  title, subtitle, children, loading, error, onRetry,
  empty, emptyMessage, backTo = '/agro', backLabel = 'Voltar ao Dashboard Agro'
}: AgroPageShellProps) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="hub-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #0B0F19)' }}>
      <DesktopSidebar />
      {sidebarOpen && (
        <div className="mobile-sidebar-backdrop" onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}>
          <MobileSidebarContent onCloseMobile={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="hub-main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden', padding: 24, gap: 16, overflowY: 'auto' }}>
        {/* Cabeçalho com voltar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <button
            onClick={() => navigate(backTo)}
            style={{
              background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)',
              borderRadius: 6, color: 'var(--text-secondary, #94A3B8)', cursor: 'pointer',
              padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
              flexShrink: 0, marginTop: 2, transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#22C55E'; e.currentTarget.style.color = '#F8FAFC'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default, #1E293B)'; e.currentTarget.style.color = '#94A3B8'; }}
            title={backLabel}
          >
            <ArrowLeft size={14} />
            <span style={{ whiteSpace: 'nowrap' }}>{backLabel}</span>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', margin: 0 }}>{title}</h1>
            {subtitle && <p style={{ fontSize: 12, color: 'var(--text-tertiary, #64748B)', margin: '4px 0 0 0' }}>{subtitle}</p>}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12, background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10 }}>
            <Loader2 size={32} color="#22C55E" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary, #94A3B8)', fontWeight: 500 }}>Consultando base de dados real do Agro...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12, background: 'var(--bg-surface, #0F172A)', border: '1px solid #EF444433', borderRadius: 10 }}>
            <AlertTriangle size={36} color="#EF4444" />
            <h3 style={{ color: '#EF4444', margin: 0, fontSize: 15, fontWeight: 700 }}>Erro ao carregar dados</h3>
            <p style={{ color: 'var(--text-secondary, #94A3B8)', fontSize: 12, textAlign: 'center', maxWidth: 400 }}>{error}</p>
            {onRetry && (
              <button onClick={onRetry} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 16px', fontSize: 12, fontWeight: 600, background: '#22C55E', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                <RefreshCw size={13} /> Tentar novamente
              </button>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && empty && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12, background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10 }}>
            <Inbox size={40} color="#64748B" />
            <p style={{ color: 'var(--text-secondary, #94A3B8)', fontSize: 13, textAlign: 'center', maxWidth: 400 }}>
              {emptyMessage || 'Nenhum registro encontrado na base consultada.'}
            </p>
          </div>
        )}

        {/* Content */}
        {!loading && !error && !empty && children}
      </div>
    </div>
  );
}
