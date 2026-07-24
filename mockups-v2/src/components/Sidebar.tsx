import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, HardHat, Tractor, Truck, Stethoscope,
  Share2, Building2, Map, Search, ChevronLeft, ChevronRight,
  LogOut, ShieldCheck
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Visão Geral', route: '/visao-geral' },
  { icon: HardHat, label: 'Engenharia', route: '/engenharia' },
  { icon: Tractor, label: 'Agro', route: '/agro' },
  { icon: Truck, label: 'Logística', route: '/logistica' },
  { icon: Stethoscope, label: 'Saúde', route: '/saude' },
  { icon: Share2, label: 'Relacionamentos', route: '/relacionamentos' },
  { icon: Building2, label: 'Empresa 360°', route: '/empresa-360' },
  { icon: Map, label: 'Inteligência Territorial', route: '/territorial' },
  { icon: Search, label: 'Busca Global', route: '/busca' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const w = collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)';

  return (
    <aside style={{
      width: `var(--sidebar-w)`,
      height: '100vh',
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-default)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 100,
      transition: 'width var(--transition-normal)',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '18px 20px', borderBottom: '1px solid var(--border-default)',
        minHeight: 64,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, var(--accent-blue), #6C5CE7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
        }}>W</div>
        <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>WiNS Hub</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>Inteligência Multivertical</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
        {navItems.map((item) => (
          {(item) => {
            const active = location.pathname === item.route;
            return (
          <a key={item.route} href={item.route} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
            fontSize: 13, fontWeight: 500,
            background: active ? 'var(--accent-blue-bg)' : 'transparent',
            textDecoration: 'none', transition: 'all var(--transition-fast)',
            marginBottom: 2,
          }}
          onMouseEnter={e => {
            if (!active) { e.currentTarget.style.background = 'var(--bg-surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }
          }}
          onMouseLeave={e => {
            if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }
          }}
          >
            <item.icon size={18} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
          </a>
            );
          })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-default)',
        fontSize: 11, color: 'var(--text-tertiary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <ShieldCheck size={14} />
          <span>Homologação</span>
        </div>
        <div style={{ marginBottom: 2 }}>William · Analista</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <LogOut size={14} />
          <span>Sair</span>
        </div>
      </div>
    </aside>
  );
}
