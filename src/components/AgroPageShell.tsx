import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, RefreshCw, Inbox, Loader2 } from 'lucide-react';
import { DesktopSidebar, MobileSidebarContent } from './AppSidebar';

interface AgroPageShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  errorRetryable?: boolean;
  onRetry?: () => void;
  empty?: boolean;
  emptyMessage?: string;
  backTo?: string;
  backLabel?: string;
  statusBadge?: string;
}

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const handler = (e: MediaQueryListEvent) => setMatch(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [q]);
  return match;
}

/**
 * Shell padronizado para todos os submódulos da suíte WiNS Hub Agro.
 * Injeta a barra lateral responsiva (Desconto de 240px em Desktop via marginLeft),
 * garantindo alinhamento perfeito sem sobreposição.
 */
export default function AgroPageShell({
  title, subtitle, children, loading, error, errorRetryable = true, onRetry,
  empty, emptyMessage, backTo = '/agro', backLabel = 'Voltar ao Dashboard Agro',
  statusBadge
}: AgroPageShellProps) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  return (
    <div className="hub-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #0B0F19)' }}>
      {isMobile ? (
        <>
          {sidebarOpen && (
            <div
              className="mobile-sidebar-backdrop"
              onClick={() => setSidebarOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}
            >
              <MobileSidebarContent onCloseMobile={() => setSidebarOpen(false)} />
            </div>
          )}
        </>
      ) : (
        <DesktopSidebar />
      )}

      {/* Main Content Area — descontando 240px em desktop */}
      <div
        className="hub-main-content"
        style={{
          marginLeft: isMobile ? 0 : 'var(--sidebar-w, 240px)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          maxWidth: isMobile ? '100vw' : 'calc(100vw - var(--sidebar-w, 240px))',
          overflowX: 'hidden',
          padding: isMobile ? 12 : 24,
          gap: 16,
          overflowY: 'auto'
        }}
      >
        {/* Cabeçalho com navegação */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(backTo)}
            style={{
              background: 'var(--bg-surface, #0F172A)',
              border: '1px solid var(--border-default, #1E293B)',
              borderRadius: 6,
              color: 'var(--text-secondary, #94A3B8)',
              cursor: 'pointer',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
              marginTop: 2,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#22C55E'; e.currentTarget.style.color = '#F8FAFC'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default, #1E293B)'; e.currentTarget.style.color = '#94A3B8'; }}
            title={backLabel}
          >
            <ArrowLeft size={14} />
            <span style={{ whiteSpace: 'nowrap' }}>{backLabel}</span>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', margin: 0 }}>{title}</h1>
              {statusBadge && (
                <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  {statusBadge}
                </span>
              )}
            </div>
            {subtitle && <p style={{ fontSize: 12, color: 'var(--text-tertiary, #64748B)', margin: '4px 0 0 0' }}>{subtitle}</p>}
          </div>
        </div>

        {/* Submenu de Navegação Rápida entre Módulos Agro */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, borderBottom: '1px solid var(--border-default, #1E293B)' }}>
          {[
            { label: 'Dashboard', path: '/agro' },
            { label: 'Propriedades', path: '/agro/propriedades' },
            { label: 'Pessoas & Vínculos', path: '/agro/leads' },
            { label: 'Holdings', path: '/agro/holdings' },
            { label: 'Oportunidades', path: '/agro/oportunidades' },
            { label: 'Agro-Logística', path: '/agro/logistica' },
            { label: 'Técnica', path: '/agro/tecnica' },
            { label: 'Deserto Veterinário', path: '/agro/deserto-veterinario' },
            { label: 'Genética & Pecuária', path: '/agro/genetica' },
          ].map((item, idx) => {
            const isActive = window.location.pathname === item.path;
            return (
              <button
                key={idx}
                onClick={() => navigate(item.path)}
                style={{
                  background: isActive ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-surface, #0F172A)',
                  color: isActive ? '#22C55E' : 'var(--text-secondary, #94A3B8)',
                  border: isActive ? '1px solid #22C55E' : '1px solid var(--border-default, #1E293B)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {item.label}
              </button>
            );
          })}
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
            {onRetry && errorRetryable && (
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
