import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, HardHat, Tractor, Truck, Stethoscope,
  Share2, Building2, Map as MP, Search, ShieldCheck, LogOut, X
} from 'lucide-react';
import { useAuth } from '../services/auth';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export const getNavItems = (currentPath: string) => [
  { icon: LayoutDashboard, label: 'Visão Geral', route: '/visao-geral', active: currentPath === '/visao-geral' },
  { icon: HardHat, label: 'Engenharia', route: '/engenharia', active: currentPath.startsWith('/engenharia') },
  { icon: Tractor, label: 'Agro', route: '/agro', active: currentPath.startsWith('/agro') },
  { icon: Truck, label: 'Logística', route: '/logistica', active: currentPath.startsWith('/logistica') },
  { icon: Stethoscope, label: 'Saúde', route: '/saude', active: currentPath.startsWith('/saude') },
  { icon: Share2, label: 'Relacionamentos', route: '/relacionamentos', active: currentPath === '/relacionamentos' },
  { icon: Building2, label: 'Empresa 360°', route: '/empresas', active: currentPath.startsWith('/empresas') },
  { icon: MP, label: 'Inteligência Territorial', route: '/territorial', active: currentPath === '/territorial' },
  { icon: Search, label: 'Busca Global', route: '/busca', active: currentPath === '/busca' },
];

export const DesktopSidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const navItems = getNavItems(location.pathname);

  const userName = user?.name || user?.email || 'William Nunes';
  const roleLabel = user?.roles?.includes('admin')
    ? 'Administrador'
    : user?.roles?.includes('gestor')
    ? 'Gestor'
    : user?.roles?.includes('analista')
    ? 'Analista'
    : 'Visualizador (VIEWER)';

  return (
    <aside style={{
      width: 'var(--sidebar-w, 240px)', height: '100vh', background: 'var(--bg-sidebar, #0F172A)',
      borderRight: '1px solid var(--border-default, #1E293B)',
      display: 'flex', flexDirection: 'column', position: 'fixed',
      left: 0, top: 0, zIndex: 100, overflow: 'hidden',
    }}>
      <div 
        onClick={() => navigate('/visao-geral')}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px',
          borderBottom: '1px solid var(--border-default, #1E293B)', minHeight: 64, cursor: 'pointer'
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, #3B82F6, #6C5CE7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
        }}>W</div>
        <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>WiNS Hub</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary, #64748B)', marginTop: 1 }}>Inteligência Multivertical</div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
        {navItems.map(item => (
          <div
            key={item.label}
            onClick={() => navigate(item.route)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px',
              borderRadius: 'var(--radius-sm, 6px)', fontSize: 13, fontWeight: 500,
              textDecoration: 'none', marginBottom: 2, cursor: 'pointer',
              background: item.active ? 'var(--accent-blue-bg, rgba(59,130,246,0.15))' : 'transparent',
              color: item.active ? 'var(--accent-blue, #3B82F6)' : 'var(--text-secondary, #94A3B8)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              if (!item.active) {
                e.currentTarget.style.background = 'var(--bg-surface-hover, rgba(255,255,255,0.05))';
                e.currentTarget.style.color = 'var(--text-primary, #F8FAFC)';
              }
            }}
            onMouseLeave={e => {
              if (!item.active) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary, #94A3B8)';
              }
            }}
          >
            <item.icon size={18} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
          </div>
        ))}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-default, #1E293B)', fontSize: 11, color: 'var(--text-tertiary, #64748B)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#22C55E', fontWeight: 600 }}>
          <ShieldCheck size={14} /><span>Oficial</span>
        </div>
        <div style={{ marginBottom: 2, fontWeight: 600, color: 'var(--text-primary, #F8FAFC)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {userName}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary, #64748B)', marginBottom: 6 }}>
          {roleLabel}
        </div>
        <div 
          onClick={logout}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#EF4444', fontWeight: 500 }}
        >
          <LogOut size={14} /><span>Sair</span>
        </div>
      </div>
    </aside>
  );
};

export const MobileSidebarContent: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const navItems = getNavItems(location.pathname);

  const userName = user?.name || user?.email || 'William Nunes';
  const roleLabel = user?.roles?.includes('admin')
    ? 'Administrador'
    : user?.roles?.includes('gestor')
    ? 'Gestor'
    : user?.roles?.includes('analista')
    ? 'Analista'
    : 'Visualizador (VIEWER)';

  const handleNav = (route: string) => {
    navigate(route);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: '1px solid var(--border-default, #1E293B)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #3B82F6, #6C5CE7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: '#fff',
          }}>W</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>WiNS Hub</div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary, #64748B)' }}>Inteligência Multivertical</div>
          </div>
        </div>
        {onCloseMobile && (
          <button onClick={onCloseMobile} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary, #64748B)', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        )}
      </div>

      <nav style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
        {navItems.map(item => (
          <div
            key={item.label}
            onClick={() => handleNav(item.route)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px',
              borderRadius: 'var(--radius-sm, 6px)', fontSize: 13, fontWeight: 500,
              marginBottom: 2, cursor: 'pointer',
              background: item.active ? 'var(--accent-blue-bg, rgba(59,130,246,0.15))' : 'transparent',
              color: item.active ? 'var(--accent-blue, #3B82F6)' : 'var(--text-secondary, #94A3B8)',
            }}
          >
            <item.icon size={18} style={{ flexShrink: 0 }} />
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-default, #1E293B)', fontSize: 11, color: 'var(--text-tertiary, #64748B)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#22C55E', fontWeight: 600 }}>
          <ShieldCheck size={14} /><span>Oficial</span>
        </div>
        <div style={{ marginBottom: 2, fontWeight: 600, color: 'var(--text-primary, #F8FAFC)' }}>
          {userName}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary, #64748B)', marginBottom: 6 }}>
          {roleLabel}
        </div>
        <div 
          onClick={logout}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#EF4444', fontWeight: 500 }}
        >
          <LogOut size={14} /><span>Sair</span>
        </div>
      </div>
    </>
  );
};
