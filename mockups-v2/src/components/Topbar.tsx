import { Search, Bell, Sun, ChevronDown, Calendar } from 'lucide-react';

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <header style={{
      height: 'var(--topbar-h)',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-default)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h1>
        {subtitle && (
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{subtitle}</p>
        )}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', width: 240 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
        <input
          placeholder="Buscar no WiNS Hub…"
          style={{
            width: '100%', height: 34, paddingLeft: 32, fontSize: 12,
            background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
          }}
        />
      </div>

      {/* Period */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <Calendar size={14} />
        <span>Jul 2026</span>
        <ChevronDown size={12} />
      </div>

      {/* Theme toggle */}
      <button style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)' }}>
        <Sun size={16} />
      </button>

      {/* Notifications */}
      <button style={{ position: 'relative', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)' }}>
        <Bell size={16} />
        <span style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-blue)' }} />
      </button>

      {/* User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-blue), #6C5CE7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff',
        }}>W</div>
        <div style={{ lineHeight: 1.3 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>William</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Analista</div>
        </div>
      </div>
    </header>
  );
}
