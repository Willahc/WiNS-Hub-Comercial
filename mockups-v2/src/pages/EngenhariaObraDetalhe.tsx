import React, { useState, useEffect, useRef } from 'react';
import {
  HardHat, Search, RotateCcw, ChevronRight, Menu, X,
  LayoutDashboard, Share2, Map as MP, LogOut, ShieldCheck,
  Bell, Sun, SlidersHorizontal, Filter, ChevronDown,
  ChevronUp, AlertTriangle, DollarSign, Home, Users,
  Briefcase, EyeOff, ChevronLeft, ArrowUpRight,
  Calendar, FolderOpen, List, Table as TbIcon, Download, Save, Bookmark,
  HelpCircle, Info, CheckCircle, XCircle, CheckSquare,
  Square, GripVertical, Columns, MapPin, FileText,
  Building2, Target, Clock, ExternalLink, MoreHorizontal,
  Tractor, Truck, Stethoscope, Plus, ArrowLeft, Share, AlertOctagon,
  TrendingUp, Award, Layers, Compass, Check, RefreshCw
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const ENG_COLOR = '#3B82F6';

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

function SemanticBadge({ type }: { type: 'EXEMPLO DE CONFIRMADO' | 'EXEMPLO DE PROVÁVEL' | 'EXEMPLO DE POTENCIAL' | 'REGRA SIMULADA: CONFIRMADO' | 'REGRA SIMULADA: PROVÁVEL' }) {
  const isConfirm = type.includes('CONFIRMADO');
  const isProv = type.includes('PROVÁVEL');
  const styles = isConfirm ? { bg: '#22C55E22', color: '#22C55E', border: '#22C55E44' }
    : isProv ? { bg: '#8B5CF622', color: '#8B5CF6', border: '#8B5CF644' }
    : { bg: '#F59E0B22', color: '#F59E0B', border: '#F59E0B44' };

  return (
    <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: styles.bg, color: styles.color, border: `1px solid ${styles.border}`, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
      {type}
    </span>
  );
}

function MobileSidebarContent({ onClose }: { onClose: () => void }) {
  const navItems = [
    { icon: LayoutDashboard, label: 'Visão Geral', route: '/visao-geral' },
    { icon: HardHat, label: 'Engenharia', route: '/engenharia' },
    { icon: HardHat, label: '— Lista de Obras', route: '/engenharia/obras', sub: true },
    { icon: HardHat, label: '— Detalhe da Obra', route: '/engenharia/obras/obra-exemplo', sub: true, active: true },
    { icon: Tractor, label: 'Agro', route: '/engenharia' },
    { icon: Truck, label: 'Logística', route: '/engenharia' },
    { icon: Stethoscope, label: 'Saúde', route: '/engenharia' },
    { icon: Share2, label: 'Relacionamentos', route: '/engenharia' },
    { icon: Building2, label: 'Empresa 360°', route: '/engenharia' },
    { icon: MP, label: 'Inteligência Territorial', route: '/engenharia' },
    { icon: Search, label: 'Busca Global', route: '/engenharia' },
  ];
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, var(--accent-blue), #6C5CE7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>W</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>WiNS Hub</div>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Inteligência Multivertical</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
      </div>
      <nav style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
        {navItems.map(item => (
          <a key={item.label} href={item.route} onClick={onClose} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: item.sub ? '6px 10px 6px 30px' : '8px 10px',
            borderRadius: 'var(--radius-sm)', color: item.active ? ENG_COLOR : 'var(--text-secondary)',
            fontSize: 12, fontWeight: item.active ? 600 : 400,
            background: item.active ? `${ENG_COLOR}18` : 'transparent',
            textDecoration: 'none', marginBottom: 1,
          }}>
            {item.sub ? null : <item.icon size={16} style={{ flexShrink: 0 }} />}
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-default)', fontSize: 10, color: 'var(--text-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}><ShieldCheck size={12} /> Homologação</div>
        <div>William · Analista</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}><LogOut size={12} /> Sair</div>
      </div>
    </>
  );
}

function DesktopSidebar() {
  const active = '/engenharia/obras/obra-exemplo';
  const nav = [
    { icon: LayoutDashboard, label: 'Visão Geral', route: '/visao-geral' },
    { icon: HardHat, label: 'Engenharia', route: '/engenharia' },
    { icon: null as any, label: '— Lista de Obras', route: '/engenharia/obras', sub: true },
    { icon: null as any, label: '— Detalhe da Obra', route: '/engenharia/obras/obra-exemplo', sub: true, active: true },
    { icon: Tractor, label: 'Agro', route: '/engenharia' },
    { icon: Truck, label: 'Logística', route: '/engenharia' },
    { icon: Stethoscope, label: 'Saúde', route: '/engenharia' },
    { icon: Share2, label: 'Relacionamentos', route: '/engenharia' },
    { icon: Building2, label: 'Empresa 360°', route: '/engenharia' },
    { icon: MP, label: 'Inteligência Territorial', route: '/engenharia' },
    { icon: Search, label: 'Busca Global', route: '/engenharia' },
  ];
  return (
    <aside style={{ width: 'var(--sidebar-w)', height: '100vh', background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0, zIndex: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 16px', borderBottom: '1px solid var(--border-default)', minHeight: 64 }}>
        <div style={{ width: 30, height: 30, borderRadius: 7, background: 'linear-gradient(135deg, var(--accent-blue), #6C5CE7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>W</div>
        <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>WiNS Hub</div><div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>Inteligência Multivertical</div></div>
      </div>
      <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
        {nav.map(item => {
          const isActive = item.active || item.route === active;
          return (
            <a key={item.label} href={item.route} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: item.sub ? '5px 10px 5px 32px' : '7px 10px',
              borderRadius: 'var(--radius-sm)', color: isActive ? ENG_COLOR : 'var(--text-secondary)',
              fontSize: 12, fontWeight: isActive ? 600 : 400,
              background: isActive ? `${ENG_COLOR}18` : 'transparent',
              textDecoration: 'none', marginBottom: 1,
            }}>
              {item.sub ? null : <item.icon size={16} style={{ flexShrink: 0 }} />}
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-default)', fontSize: 10, color: 'var(--text-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}><ShieldCheck size={12} /> Homologação</div>
        <div>William · Analista</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}><LogOut size={12} /> Sair</div>
      </div>
    </aside>
  );
}

const tabsList = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'fornecedores', label: 'Fornecedores' },
  { id: 'decisores', label: 'Decisores' },
  { id: 'oportunidades', label: 'Oportunidades' },
  { id: 'territorial', label: 'Territorial' },
  { id: 'eventos', label: 'Eventos' },
  { id: 'proveniencia', label: 'Proveniência' },
];

export default function EngenhariaObraDetalhe() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1199px)');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('resumo');
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tabsNavRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2800); };

  const handleTabClick = (tabId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    setActiveTab(tabId);
    if (isMobile && e.currentTarget) {
      e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  };

  // Initialize Leaflet map in Territorial tab
  useEffect(() => {
    if (activeTab === 'territorial' && mapContainerRef.current && !mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView([-22.8800, -43.1100], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
        maxZoom: 18,
      }).addTo(map);

      // Main Obra Marker
      const mainIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="background:#3B82F6;width:24px;height:24px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px #3B82F6"><div style="width:8px;height:8px;background:#fff;border-radius:50%"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      L.marker([-22.8800, -43.1100], { icon: mainIcon }).addTo(map)
        .bindPopup('<b>Obra Exemplo — Reforço Ponte Atlântica</b><br>Niterói / RJ · R$ 47,2M (Exemplo)');

      // Nearby Marker 1
      const subIcon = L.divIcon({
        className: 'custom-leaflet-marker-sub',
        html: `<div style="background:#8B5CF6;width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px #8B5CF6"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([-22.8950, -43.1250], { icon: subIcon }).addTo(map)
        .bindPopup('<b>Fornecedor Fictício A</b><br>Match simulado (88%)');

      // Nearby Marker 2
      L.marker([-22.8700, -43.0900], { icon: subIcon }).addTo(map)
        .bindPopup('<b>Terminal Logístico Ilustrativo</b><br>Equipamento próximo');

      mapInstanceRef.current = map;
    }
    return () => {
      if (mapInstanceRef.current && activeTab !== 'territorial') {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [activeTab]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
          background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)', padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-lg)', pointerEvents: 'none',
        }}>
          <Info size={14} color={ENG_COLOR} />
          {toast}
        </div>
      )}

      {isMobile ? (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 200, opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'auto' : 'none', transition: 'opacity 0.2s' }} onClick={() => setSidebarOpen(false)} />
          <aside style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: 280, background: 'var(--bg-sidebar)', zIndex: 201, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s ease', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-default)' }}>
            <MobileSidebarContent onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      ) : (
        <DesktopSidebar />
      )}

      <div style={{ marginLeft: isMobile ? 0 : 'var(--sidebar-w)', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100vw' }}>
        
        {/* ── Topbar ── */}
        <header style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ height: 'var(--topbar-h)', display: 'flex', alignItems: 'center', padding: isMobile ? '0 12px' : '0 24px', gap: isMobile ? 8 : 16 }}>
            {isMobile && <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}><Menu size={20} /></button>}
            
            <div style={{ flex: 1, minWidth: 0 }}>
              {!isMobile && (
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                  <a href="/engenharia" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Engenharia</a>
                  <span style={{ margin: '0 4px' }}>/</span>
                  <a href="/engenharia/obras" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Obras</a>
                  <span style={{ margin: '0 4px' }}>/</span>
                  <span style={{ color: ENG_COLOR }}>Detalhe</span>
                </div>
              )}
              <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {isMobile ? 'Detalhe da Obra' : 'Ficha de Inteligência da Obra'}
              </h1>
            </div>

            <div style={{ position: 'relative', width: isMobile ? 120 : 200, flexShrink: 0 }}>
              <Search size={12} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input placeholder={isMobile ? 'Buscar…' : 'Buscar no diretório…'} style={{ width: '100%', height: 30, paddingLeft: 24, fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }} />
            </div>

            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
                <Calendar size={12} /><span>Jul 2026</span><ChevronDown size={9} />
              </div>
            )}
            {!isMobile && (
              <button style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Sun size={13} />
              </button>
            )}
            {!isMobile && (
              <button style={{ position: 'relative', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Bell size={13} />
                <span style={{ position: 'absolute', top: 5, right: 5, width: 5, height: 5, borderRadius: '50%', background: ENG_COLOR }} />
              </button>
            )}
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px 3px 3px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), #6C5CE7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>W</div>
                <div style={{ lineHeight: 1.2 }}><div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>William</div><div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Analista</div></div>
              </div>
            )}
          </div>
        </header>

        {/* ── Main Content Area ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 24, maxWidth: 1680, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>

            {/* Breadcrumb Mobile */}
            {isMobile && (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                <a href="/engenharia" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Engenharia</a> / <a href="/engenharia/obras" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Obras</a> / <span style={{ color: ENG_COLOR }}>Detalhe</span>
              </div>
            )}

            {/* ── PERSISTENT PROTOTYPE DISCLAIMER BANNER ── */}
            <div style={{
              background: '#F59E0B1A', border: '1px solid #F59E0B44', borderRadius: 'var(--radius-md)',
              padding: isMobile ? '8px 12px' : '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <AlertTriangle size={isMobile ? 16 : 18} color="#F59E0B" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: isMobile ? 10 : 11, color: '#F59E0B', fontWeight: 500, lineHeight: 1.4 }}>
                <strong>PROTÓTIPO — </strong>
                Nomes, empresas, documentos, valores, datas, fontes e vínculos são fictícios e existem somente para validação visual.
              </div>
            </div>

            {/* ── Page Header / Title & Actions ── */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: isMobile ? 14 : 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: `${ENG_COLOR}18`, color: ENG_COLOR, fontWeight: 600 }}>Engenharia</span>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: '#22C55E18', color: '#22C55E', fontWeight: 600 }}>Em execução</span>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: '#8B5CF618', color: '#8B5CF6', fontWeight: 600 }}>CAPEX homologado (Exemplo)</span>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: '#10B98118', color: '#10B981', fontWeight: 600 }}>Dados demonstrativos</span>
                  </div>

                  <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                    Reforço Estrutural — Ponte Atlântica
                  </h1>
                  <p style={{ fontSize: isMobile ? 11 : 12, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 8 }}>
                    Ficha executiva, vínculos, oportunidades e proveniência simuladas
                  </p>
                </div>

                {/* Header Action Buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <a href="/engenharia/obras" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', textDecoration: 'none', cursor: 'pointer' }}>
                    <ArrowLeft size={11} /> Voltar à lista
                  </a>
                  {!isMobile && (
                    <>
                      <button onClick={() => showToast('💾 Obra salva em sua lista de acompanhamento')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <Bookmark size={11} /> Salvar em lista
                      </button>
                      <button onClick={() => { setActiveTab('territorial'); showToast('MAPA: Navegando para o mapa territorial'); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <MP size={11} /> Ver no mapa
                      </button>
                      <button onClick={() => showToast('🔗 Link de compartilhamento copiado')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <Share size={11} /> Compartilhar
                      </button>
                    </>
                  )}
                  {isMobile && (
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setMoreActionsOpen(!moreActionsOpen)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        Mais <MoreHorizontal size={11} />
                      </button>
                      {moreActionsOpen && (
                        <div style={{ position: 'absolute', right: 0, top: 30, zIndex: 90, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 6, padding: 4, width: 150, boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <button onClick={() => { setMoreActionsOpen(false); showToast('💾 Salva em lista'); }} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Bookmark</button>
                          <button onClick={() => { setMoreActionsOpen(false); setActiveTab('territorial'); }} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Ver no mapa</button>
                          <button onClick={() => { setMoreActionsOpen(false); showToast('🔗 Link copiado'); }} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Compartilhar</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── 5. Executive Summary Strip (6 key items + secondary row) ── */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: isMobile ? 12 : 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : (isTablet ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)'), gap: isMobile ? 10 : 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12, marginBottom: 12 }}>
                
                {/* 1. Município/UF */}
                <div>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>1. Município / UF</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Niterói / RJ</span>
                  <span style={{ fontSize: 8, color: 'var(--text-tertiary)', display: 'block' }}>Localização escolhida exclusivamente para demonstração visual.</span>
                </div>

                {/* 2. Empresa */}
                <div>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>2. Empresa</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Consórcio Infraestrutura Exemplo S.A.</span>
                    <SemanticBadge type="EXEMPLO DE CONFIRMADO" />
                  </div>
                  <span style={{ fontSize: 8, color: 'var(--text-tertiary)', display: 'block', marginTop: 1 }}>CNPJ ilustrativo: XX.XXX.XXX/0001-XX</span>
                </div>

                {/* 3. Fase */}
                <div>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>3. Fase</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#22C55E' }}>Execução</span>
                </div>

                {/* 4. Status */}
                <div>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>4. Status</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Em andamento</span>
                </div>

                {/* 5. CAPEX */}
                <div>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>5. CAPEX</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>R$ 47,2 milhões</span>
                    <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 4, background: '#8B5CF622', color: '#8B5CF6', fontWeight: 600 }}>Homologado (Simulado)</span>
                  </div>
                </div>

                {/* 6. Atualização */}
                <div>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block', marginBottom: 2 }}>6. Atualização</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Jul/2026</span>
                </div>
              </div>

              {/* Secondary Detail Row */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 10, color: 'var(--text-tertiary)' }}>
                <span><strong>Setor:</strong> Transporte (Infraestrutura Rodoviária)</span>
                <span><strong>Fonte Ilustrativa:</strong> Sistema de Obras Exemplo</span>
                <span><strong>Precisão Geográfica:</strong> Exemplo de precisão geográfica</span>
                <span><strong>ID Ilustrativo:</strong> #OBR-2026-001</span>
              </div>
            </div>

            {/* ── 6. Compact Indicators Cards (4 cards) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 8 : 12 }}>
              
              {/* Indicator 1 */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Oportunidades associadas</span>
                  <HelpCircle size={10} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} onClick={() => showToast('ℹ️ Oportunidades comerciais calculadas por algoritmo de aderência simulado')} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>4 matches</div>
                <span style={{ fontSize: 9, color: ENG_COLOR, marginTop: 2, display: 'block' }}>Aderência simulada</span>
              </div>

              {/* Indicator 2 */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Maior score</span>
                  <HelpCircle size={10} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} onClick={() => showToast('ℹ️ Score algorítmico baseado em regras demonstrativas')} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#8B5CF6' }}>92</span>
                  <SemanticBadge type="EXEMPLO DE PROVÁVEL" />
                </div>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2, display: 'block' }}>Regra simulada no protótipo</span>
              </div>

              {/* Indicator 3 - Corrected Label & Legend */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Relacionamentos</span>
                  <HelpCircle size={10} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} onClick={() => showToast('ℹ️ Relações corporativas e territoriais simuladas no protótipo')} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>6 relações mapeadas</div>
                <span style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 2, display: 'block' }}>1 confirmação simulada · 4 prováveis · 1 potencial</span>
              </div>

              {/* Indicator 4 - Corrected 100% Quality */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Qualidade cadastral</span>
                  <HelpCircle size={10} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} onClick={() => showToast('ℹ️ Preenchimento de critérios no exemplo visual')} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#22C55E' }}>100%</div>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2, display: 'block' }}>8/8 critérios ilustrativos preenchidos</span>
              </div>
            </div>

            {/* ── 7. Tabs Navigation Bar (8 tabs) with Mobile Scroll & Active Focus ── */}
            <div style={{ position: 'relative', width: '100%' }}>
              <div
                ref={tabsNavRef}
                style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', padding: '4px 8px', overflowX: 'auto',
                  display: 'flex', gap: 4, sticky: 'top', top: 56, zIndex: 40,
                  scrollbarWidth: 'none', msOverflowStyle: 'none',
                }}
              >
                {tabsList.map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={(e) => handleTabClick(tab.id, e)}
                      style={{
                        padding: '6px 14px', fontSize: 11, fontWeight: isActive ? 600 : 400,
                        borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                        background: isActive ? `${ENG_COLOR}22` : 'transparent',
                        color: isActive ? ENG_COLOR : 'var(--text-secondary)',
                        whiteSpace: 'nowrap', transition: 'all 0.15s ease', flexShrink: 0,
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Mobile overflow indicator hint */}
              {isMobile && (
                <div style={{
                  position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                  pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 2,
                  fontSize: 8, color: 'var(--text-tertiary)', background: 'linear-gradient(to left, var(--bg-surface) 60%, transparent)',
                  paddingLeft: 12, height: '80%',
                }}>
                  <ChevronRight size={12} color="var(--text-tertiary)" />
                </div>
              )}
            </div>

            {/* ── Tab Content ── */}

            {/* ABA 1: RESUMO (Layout 65% / 35%) */}
            {activeTab === 'resumo' && (
              <div style={{ display: 'flex', gap: 16, flexDirection: isMobile ? 'column' : 'row' }}>
                
                {/* Coluna Principal (65%) */}
                <div style={{ flex: isMobile ? '1 1 100%' : '0 0 65%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* Descrição Executiva */}
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 0, marginBottom: 8 }}>
                      Descrição Executiva (Exemplo Ilustrativo)
                    </h3>
                    <p style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>
                      Exemplo de ficha técnica para validação visual do layout: Obra de intervenção estrutural complexa para reforço e manutenção da Ponte Atlântica. O projeto engloba substituição simulada de aparelhos de apoio, reforço das vigas pré-moldadas e adequação de sistemas de monitoramento. Todos os parâmetros exibidos servem exclusivamente como demonstração da interface.
                    </p>
                  </div>

                  {/* Cronologia */}
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        Cronologia da Obra
                      </h3>
                      <span style={{ fontSize: 9, color: '#F59E0B', fontStyle: 'italic' }}>
                        Eventos e datas fictícios para demonstração da cronologia.
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderLeft: '2px solid var(--border-subtle)', paddingLeft: 12, marginLeft: 6 }}>
                      {[
                        { date: 'Jul/2026', type: 'Atualização de Fase', source: 'Sistema de Obras Exemplo', desc: 'Fase de Execução mantida no modelo de demonstração.', ev: 'REGRA SIMULADA: CONFIRMADO' },
                        { date: 'Jun/2026', type: 'Geração de Oportunidades', source: 'Algoritmo de Match do Protótipo', desc: '4 novos matches comerciais identificados por regra simulada.', ev: 'REGRA SIMULADA: PROVÁVEL' },
                        { date: 'Mai/2026', type: 'Simulação de Orçamento', source: 'Publicação Técnica Simulada', desc: 'Orçamento de R$ 47,2M homologado no protótipo.', ev: 'REGRA SIMULADA: CONFIRMADO' },
                        { date: 'Fev/2026', type: 'Vínculo Empresarial Ilustrativo', source: 'Cadastro Empresarial Demonstrativo', desc: 'Consórcio Infraestrutura Exemplo S.A. vinculado ao registro.', ev: 'REGRA SIMULADA: CONFIRMADO' },
                        { date: 'Jan/2026', type: 'Criação do Registro', source: 'Sistema de Obras Exemplo', desc: 'Inclusão inicial no protótipo de inteligência territorial.', ev: 'REGRA SIMULADA: CONFIRMADO' },
                      ].map((item, idx) => (
                        <div key={idx} style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: -17, top: 2, width: 8, height: 8, borderRadius: '50%', background: ENG_COLOR }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>{item.date}</span>
                            <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>· {item.type}</span>
                            <SemanticBadge type={item.ev as any} />
                          </div>
                          <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0 }}>{item.desc}</p>
                          <span style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>Fonte: {item.source}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Escopo Técnico */}
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 0, marginBottom: 12 }}>
                      Escopo Técnico & Parâmetros (Demonstrativos)
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10 }}>
                      {[
                        { label: 'Categoria', val: 'Infraestrutura de Transporte' },
                        { label: 'Subsegmento', val: 'Pontes e Viadutos Especiais' },
                        { label: 'Tipo de Intervenção', val: 'Reforço Estrutural (Simulado)' },
                        { label: 'Órgão Relacionado', val: 'Órgão Concedente Demonstrativo' },
                        { label: 'Empresa Executora', val: 'Consórcio Infraestrutura Exemplo S.A. (CNPJ XX.XXX.XXX/0001-XX)' },
                        { label: 'Cobertura Territorial', val: 'Regional Baía de Guanabara (Niterói - RJ)' },
                      ].map(item => (
                        <div key={item.label} style={{ background: 'var(--bg-base)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block' }}>{item.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{item.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lacunas e Alertas */}
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={16} color="#22C55E" />
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Nenhuma lacuna crítica no exemplo visual</span>
                        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                          Todos os 8 critérios ilustrativos estão preenchidos no exemplo visual.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coluna Lateral (35%) */}
                <div style={{ flex: isMobile ? '1 1 100%' : '0 0 35%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* Checklist Qualidade Cadastral */}
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 0, marginBottom: 4 }}>
                      Qualidade Cadastral (100%)
                    </h3>
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block', marginBottom: 12 }}>
                      8/8 critérios ilustrativos preenchidos no exemplo visual
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[
                        { label: 'Identificação da Obra', st: 'Preenchido no exemplo visual' },
                        { label: 'Município / UF', st: 'Preenchido no exemplo visual' },
                        { label: 'Coordenada Geográfica', st: 'Preenchido no exemplo visual' },
                        { label: 'Empresa / CNPJ', st: 'Preenchido no exemplo visual' },
                        { label: 'Fase de Execução', st: 'Preenchido no exemplo visual' },
                        { label: 'CAPEX Homologado', st: 'Preenchido no exemplo visual' },
                        { label: 'Fonte Principal', st: 'Preenchido no exemplo visual' },
                        { label: 'Atualização Recente', st: 'Preenchido no exemplo visual' },
                      ].map(item => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                          <span style={{ fontWeight: 600, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Check size={11} /> {item.st}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ações Rápidas */}
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 0, marginBottom: 12 }}>
                      Ações Rápidas
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button onClick={() => showToast('🏢 Empresa 360° — disponível na próxima fase')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left' }}>
                        <Building2 size={12} color={ENG_COLOR} /> Abrir Empresa 360° (Exemplo)
                      </button>
                      <button onClick={() => setActiveTab('oportunidades')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left' }}>
                        <Target size={12} color="#8B5CF6" /> Ver oportunidades (4 matches)
                      </button>
                      <button onClick={() => setActiveTab('fornecedores')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left' }}>
                        <Users size={12} color="#22C55E" /> Ver fornecedores (4 recomendados)
                      </button>
                      <button onClick={() => setActiveTab('territorial')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left' }}>
                        <MapPin size={12} color="#F59E0B" /> Abrir no mapa territorial
                      </button>
                      <button onClick={() => { navigator.clipboard?.writeText('#OBR-2026-001'); showToast('📋 Identificação copiada (#OBR-2026-001)'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left' }}>
                        <FileText size={12} color="var(--text-tertiary)" /> Copiar identificação
                      </button>
                    </div>
                  </div>

                  {/* Fonte Principal */}
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 0, marginBottom: 8 }}>
                      Fonte Ilustrativa da Página
                    </h3>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div><strong>Exemplo de sistema:</strong> Sistema de Obras Exemplo</div>
                      <div><strong>Data ilustrativa:</strong> 15/07/2026</div>
                      <div><strong>Regra de recorte:</strong> Exemplo de recorte espacial</div>
                      <span style={{ fontSize: 8, color: '#F59E0B', fontStyle: 'italic', marginTop: 4 }}>
                        Fonte não consultada neste mockup. Todos os dados são fictícios.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 2: EMPRESA */}
            {activeTab === 'empresa' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Banner de Empresa Fictícia */}
                <div style={{ background: '#F59E0B18', border: '1px solid #F59E0B44', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={14} color="#F59E0B" />
                  <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>
                    Empresa e atributos fictícios para validação visual.
                  </span>
                </div>

                {/* Card Principal da Empresa */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <SemanticBadge type="EXEMPLO DE CONFIRMADO" />
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Regra simulada: chave empresarial explícita</span>
                      </div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        Consórcio Infraestrutura Exemplo S.A.
                      </h2>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        CNPJ ilustrativo: XX.XXX.XXX/0001-XX · Situação ilustrativa: ativa
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => showToast('🏢 Empresa 360° — disponível na próxima fase')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 10, background: ENG_COLOR, border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                        <Building2 size={12} /> Abrir Empresa 360°
                      </button>
                      <button onClick={() => showToast('📁 Outras obras fictícias')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        Ver outras obras
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, background: 'var(--bg-base)', padding: 14, borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block' }}>Município Sede</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Niterói / RJ</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block' }}>Exemplo de CNAE</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>42.11-1-01 (Construção de rodovias)</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block' }}>Papel na Obra</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Executora Principal (Exemplo)</span>
                    </div>
                  </div>
                </div>

                {/* Mini-resumo Estatístico Simulado */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block' }}>Obras simuladas</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>3 obras no exemplo</span>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block' }}>Oportunidades</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#8B5CF6' }}>4 matches</span>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block' }}>Presença territorial</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>RJ, SP, SC</span>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'block' }}>Ocorrências simuladas</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Exemplo de ocorrência</span>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 3: FORNECEDORES */}
            {activeTab === 'fornecedores' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Mandatory Disclaimer */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Info size={14} color="#8B5CF6" />
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    <strong>Recomendação algorítmica ilustrativa — não representa contrato, homologação ou fornecimento confirmado.</strong>
                    <span style={{ marginLeft: 6 }}><SemanticBadge type="EXEMPLO DE PROVÁVEL" /></span>
                  </div>
                </div>

                {/* Filtros da Aba */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Filtrar por:</span>
                  <select style={{ fontSize: 9, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                    <option value="">Score mínimo: Todos</option>
                    <option value="90">Score 90+</option>
                    <option value="80">Score 80+</option>
                  </select>
                  <select style={{ fontSize: 9, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                    <option value="">Especialidade: Todas</option>
                    <option value="estrutura">Estrutura & Concreto</option>
                    <option value="geotecnia">Geotecnia & Fundações</option>
                  </select>
                </div>

                {/* Lista de Cards de Fornecedores Fictícios */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
                  {[
                    { name: 'Fornecedor Fictício A (Estruturas Exemplo)', cnpj: 'XX.XXX.XXX/0001-XX', mun: 'Araranguá / SC', cnae: '42.92-8-01', score: 92, just: 'Compatibilidade setorial simulada para pré-moldados e reforço de pontes no exemplo de protótipo.', obras: 5, at: 'Jun/2026' },
                    { name: 'Fornecedor Fictício B (TecnoConcreto Exemplo)', cnpj: 'XX.XXX.XXX/0001-XX', mun: 'Rio de Janeiro / RJ', cnae: '23.30-3-01', score: 88, just: 'Proximidade territorial ilustrativa (22km) e CNAE compatível no exemplo de protótipo.', obras: 8, at: 'Jul/2026' },
                    { name: 'Fornecedor Fictício C (Geotecnia Exemplo)', cnpj: 'XX.XXX.XXX/0001-XX', mun: 'Uberlândia / MG', cnae: '43.91-6-00', score: 85, just: 'Aderência técnica demonstrativa em reforço de pilares no cenário simulado.', obras: 4, at: 'Jul/2026' },
                    { name: 'Fornecedor Fictício D (GeoSonda Exemplo)', cnpj: 'XX.XXX.XXX/0001-XX', mun: 'Santos / SP', cnae: '71.12-0-00', score: 76, just: 'Compatibilidade setorial simulada em instrumentação para infraestruturas marítimas.', obras: 3, at: 'Jun/2026' },
                  ].map(f => (
                    <div key={f.name} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{f.name}</span>
                            <SemanticBadge type="EXEMPLO DE PROVÁVEL" />
                          </div>
                          <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>CNPJ ilustrativo: {f.cnpj} · {f.mun}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: '#8B5CF6' }}>{f.score}</span>
                          <span style={{ fontSize: 8, color: 'var(--text-tertiary)', display: 'block' }}>Score match</span>
                        </div>
                      </div>

                      <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, background: 'var(--bg-base)', padding: 8, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                        💡 <strong>Exemplo de racional do match:</strong> {f.just}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        <span>Obras compatíveis no exemplo: {f.obras} · Atualização: {f.at}</span>
                        <button onClick={() => showToast(`🔍 Visualizar fornecedor ${f.name}`)} style={{ background: 'none', border: 'none', color: ENG_COLOR, cursor: 'pointer', padding: 0, fontSize: 9, textDecoration: 'underline' }}>
                          Ver exemplo »
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ABA 4: DECISORES (Personas Fictícias) */}
            {activeTab === 'decisores' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Info size={14} color="#8B5CF6" />
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    <strong>Personas fictícias para validação de layout — Identidade corporativa simulada.</strong>
                    <span style={{ marginLeft: 6 }}><SemanticBadge type="EXEMPLO DE PROVÁVEL" /></span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
                  {[
                    { name: 'Pessoa Executiva A', role: 'Diretor de Engenharia de Infraestrutura (Exemplo)', emp: 'Consórcio Infraestrutura Exemplo S.A.', city: 'Rio de Janeiro / RJ', src: 'Exemplo de fonte corporativa — não consultada', at: 'Jul/2026' },
                    { name: 'Pessoa Executiva B', role: 'Gerente Geral de Suprimentos (Exemplo)', emp: 'Consórcio Infraestrutura Exemplo S.A.', city: 'Niterói / RJ', src: 'Exemplo de fonte corporativa — não consultada', at: 'Jun/2026' },
                    { name: 'Pessoa Técnica C', role: 'Coordenadora de Contratos (Exemplo)', emp: 'Organização Demonstrativa C', city: 'Rio de Janeiro / RJ', src: 'Exemplo de fonte corporativa — não consultada', at: 'Jul/2026' },
                    { name: 'Pessoa Técnica D', role: 'Engenheiro Residente da Obra (Exemplo)', emp: 'Consórcio Infraestrutura Exemplo S.A.', city: 'Niterói / RJ', src: 'Exemplo de fonte corporativa — não consultada', at: 'Mai/2026' },
                  ].map(p => (
                    <div key={p.name} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</span>
                            <SemanticBadge type="EXEMPLO DE PROVÁVEL" />
                          </div>
                          <span style={{ fontSize: 10, color: ENG_COLOR, fontWeight: 500 }}>{p.role}</span>
                        </div>
                      </div>

                      <div style={{ fontSize: 9, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--bg-base)', padding: 6, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                        <span><strong>Empresa ilustrativa:</strong> {p.emp}</span>
                        <span><strong>Cidade:</strong> {p.city}</span>
                        <span><strong>Origem:</strong> {p.src}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, color: 'var(--text-tertiary)' }}>
                        <span style={{ fontStyle: 'italic', color: '#F59E0B' }}>Perfil fictício para validação de layout</span>
                        <button onClick={() => showToast(`👤 Perfil de ${p.name}`)} style={{ background: 'none', border: 'none', color: ENG_COLOR, cursor: 'pointer', padding: 0, fontSize: 9, textDecoration: 'underline' }}>
                          Abrir perfil »
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ABA 5: OPORTUNIDADES */}
            {activeTab === 'oportunidades' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Target size={14} color="#8B5CF6" />
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    <strong>Scores indicam aderência algorítmica ao contexto da obra.</strong> Nunca utilizar venda fechada ou contrato confirmado.
                    <span style={{ marginLeft: 6 }}><SemanticBadge type="EXEMPLO DE PROVÁVEL" /></span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { score: 92, rec: 'Fornecedor Fictício A', cat: 'Materiais Especiais (Exemplo: Apoios Elastométricos)', capex: 'R$ 47,2M', mun: 'Niterói / RJ', setor: 'Transporte', matches: 4, at: 'Jul/2026', just: 'Compatibilidade setorial simulada para substituição de juntas e apoios em pontes marítimas.' },
                    { score: 88, rec: 'Fornecedor Fictício B', cat: 'Equipamentos Pesados (Exemplo: Guindastes)', capex: 'R$ 47,2M', mun: 'Niterói / RJ', setor: 'Transporte', matches: 3, at: 'Jul/2026', just: 'Proximidade do canteiro de obras no exemplo de protótipo.' },
                    { score: 85, rec: 'Fornecedor Fictício C', cat: 'Serviços Especializados (Exemplo: Grauteamento)', capex: 'R$ 47,2M', mun: 'Niterói / RJ', setor: 'Transporte', matches: 3, at: 'Jul/2026', just: 'Aderência ao escopo simulado em fissuras de pilares pré-moldados.' },
                    { score: 76, rec: 'Fornecedor Fictício D', cat: 'Tecnologia & Ensaios (Exemplo: Instrumentação)', capex: 'R$ 47,2M', mun: 'Niterói / RJ', setor: 'Transporte', matches: 2, at: 'Jun/2026', just: 'Compatibilidade setorial simulada para monitoramento dinâmico.' },
                  ].map(op => (
                    <div key={op.cat} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{op.cat}</span>
                            <SemanticBadge type="EXEMPLO DE PROVÁVEL" />
                          </div>
                          <span style={{ fontSize: 10, color: ENG_COLOR, fontWeight: 500 }}>Empresa Recomendada no Exemplo: {op.rec}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 18, fontWeight: 700, color: '#8B5CF6' }}>{op.score}</span>
                          <span style={{ fontSize: 8, color: 'var(--text-tertiary)', display: 'block' }}>Match score</span>
                        </div>
                      </div>

                      <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, background: 'var(--bg-base)', padding: 8, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                        💡 <strong>Exemplo de racional do match:</strong> {op.just}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        <span>CAPEX: {op.capex} · Município: {op.mun} · Setor: {op.setor} · Matches relacionados: {op.matches}</span>
                        <button onClick={() => showToast(`🎯 Oportunidade: ${op.cat}`)} style={{ background: 'none', border: 'none', color: ENG_COLOR, cursor: 'pointer', padding: 0, fontSize: 9, textDecoration: 'underline' }}>
                          Ver exemplo »
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ABA 6: TERRITORIAL (Strict Mobile Order: 1. Mapa (280px) -> 2. Legenda -> 3. Painel Contextual) */}
            {activeTab === 'territorial' && (
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16 }}>
                
                {/* Embedded Leaflet Map (Height 280px on Mobile, 420px on Desktop) */}
                <div style={{ width: isMobile ? '100%' : '60%', height: isMobile ? 280 : 420, minHeight: isMobile ? 280 : 420, background: '#0a0a0a', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                  <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: isMobile ? 280 : 420 }} />
                </div>

                {/* Painel Lateral Contextual & Legenda */}
                <div style={{ flex: isMobile ? '1 1 100%' : '0 0 40%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      <MP size={14} color="#F59E0B" />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Contexto Territorial de Niterói / RJ</span>
                      <SemanticBadge type="EXEMPLO DE POTENCIAL" />
                    </div>

                    <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '0 0 10px' }}>
                      <strong>Coincidência territorial não representa vínculo contratual ou operacional.</strong>
                    </p>

                    <div style={{ padding: 8, background: '#F59E0B18', borderRadius: 4, border: '1px solid #F59E0B44', fontSize: 9, color: '#F59E0B', marginBottom: 10 }}>
                      Contagens e marcadores fictícios para validação visual.
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                      {[
                        { label: 'Obras no município (Exemplo)', val: '14 obras' },
                        { label: 'Empresas no exemplo', val: '8 empresas' },
                        { label: 'Oportunidades simuladas', val: '12 matches' },
                        { label: 'Transportadores no exemplo', val: '5 empresas' },
                        { label: 'Estabelecimentos CNES', val: '4 no exemplo' },
                        { label: 'Imóveis CAR (Agro)', val: '9 cadastros' },
                      ].map(item => (
                        <div key={item.label} style={{ background: 'var(--bg-base)', padding: 8, borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: 8, color: 'var(--text-tertiary)', display: 'block' }}>{item.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{item.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 7: EVENTOS */}
            {activeTab === 'eventos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      Timeline de Eventos Técnicos
                    </h3>
                    <span style={{ fontSize: 9, color: '#F59E0B', fontStyle: 'italic' }}>
                      Eventos e datas fictícios para demonstração da cronologia.
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderLeft: '2px solid var(--border-subtle)', paddingLeft: 14, marginLeft: 6 }}>
                    {[
                      { date: '15/07/2026', title: 'Revisão Cadastral Demonstrativa', desc: 'Validação de exemplo dos 8 critérios ilustrativos.', source: 'Exemplo de engine', ev: 'REGRA SIMULADA: CONFIRMADO' },
                      { date: '02/07/2026', title: 'Atualização de Recorte de Oportunidades', desc: '4 novos matches identificados no modelo de demonstração.', source: 'Algoritmo de Match do Protótipo', ev: 'REGRA SIMULADA: PROVÁVEL' },
                      { date: '18/06/2026', title: 'Relatório de Progresso Físico', desc: 'Avanço de exemplo para 68% de execução física.', source: 'Sistema de Obras Exemplo', ev: 'REGRA SIMULADA: CONFIRMADO' },
                      { date: '10/05/2026', title: 'Simulação de CAPEX', desc: 'Aprovação de R$ 47,2M no orçamento simulado.', source: 'Publicação Técnica Simulada', ev: 'REGRA SIMULADA: CONFIRMADO' },
                      { date: '12/02/2026', title: 'Vínculo Empresarial Ilustrativo', desc: 'Consórcio Infraestrutura Exemplo S.A. atribuído no protótipo.', source: 'Cadastro Empresarial Demonstrativo', ev: 'REGRA SIMULADA: CONFIRMADO' },
                      { date: '15/01/2026', title: 'Criação do Registro', desc: 'Inclusão inicial no diretório territorial simulado.', source: 'Sistema de Obras Exemplo', ev: 'REGRA SIMULADA: CONFIRMADO' },
                    ].map((e, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: -19, top: 3, width: 8, height: 8, borderRadius: '50%', background: ENG_COLOR }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>{e.date}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: ENG_COLOR }}>— {e.title}</span>
                          <SemanticBadge type={e.ev as any} />
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{e.desc}</p>
                        <span style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>Fonte: {e.source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ABA 8: PROVENIÊNCIA (Mobile Vertical Cards vs Desktop Table) */}
            {activeTab === 'proveniencia' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      Proveniência simulada e rastreabilidade do protótipo
                    </h3>
                    <span style={{ fontSize: 9, color: '#F59E0B', fontWeight: 600 }}>
                      Fonte não consultada neste mockup.
                    </span>
                  </div>

                  {isMobile ? (
                    /* Mobile 100% Width Vertical Attribute Cards */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { field: 'Nome', val: 'Reforço Estrutural — Ponte Atlântica', src: 'Exemplo: fonte de obras', rule: 'Nome no exemplo de protótipo', at: '15/07/2026', q: 'Demonstrativo', obs: 'Exemplo de visualização' },
                        { field: 'Município/UF', val: 'Niterói / RJ', src: 'Exemplo: referência geográfica', rule: 'Cruzamento de malha municipal', at: '15/07/2026', q: 'Demonstrativo', obs: 'Exemplo de coordenada' },
                        { field: 'Coordenada', val: '-22.8800, -43.1100', src: 'Exemplo: referência geográfica', rule: 'Geo-referenciamento vetorial', at: '10/06/2026', q: 'Demonstrativo', obs: 'Exemplo de precisão geográfica' },
                        { field: 'Empresa', val: 'Consórcio Infraestrutura Exemplo S.A.', src: 'Exemplo: cadastro empresarial', rule: 'Chave empresarial simulada', at: '12/02/2026', q: 'Demonstrativo', obs: 'EXEMPLO DE CONFIRMADO' },
                        { field: 'CNPJ', val: 'XX.XXX.XXX/0001-XX', src: 'Exemplo: cadastro empresarial', rule: 'CNPJ ilustrativo', at: '12/02/2026', q: 'Demonstrativo', obs: 'CNPJ ilustrativo' },
                        { field: 'Fase', val: 'Execução', src: 'Exemplo: fonte de obras', rule: 'Status simulado de acompanhamento', at: '15/07/2026', q: 'Demonstrativo', obs: 'Aderente no exemplo' },
                        { field: 'Status', val: 'Em andamento', src: 'Exemplo: fonte de obras', rule: 'Boletim demonstrativo', at: '15/07/2026', q: 'Demonstrativo', obs: 'Aderente no exemplo' },
                        { field: 'CAPEX', val: 'R$ 47,2M', src: 'Exemplo: fonte de obras', rule: 'Orçamento homologado no protótipo', at: '10/05/2026', q: 'Demonstrativo', obs: 'Homologado (Simulado)' },
                        { field: 'Oportunidades', val: '4 matches', src: 'Exemplo: algoritmo de match', rule: 'Proximidade & Aderência', at: '02/07/2026', q: 'Demonstrativo', obs: 'EXEMPLO DE PROVÁVEL' },
                      ].map((row, idx) => (
                        <div key={idx} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Campo: {row.field}</span>
                            <span style={{ fontSize: 9, fontWeight: 600, color: '#22C55E' }}>{row.q}</span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: ENG_COLOR, marginTop: 2 }}>{row.val}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--bg-surface)', padding: 8, borderRadius: 4, border: '1px solid var(--border-subtle)', marginTop: 4 }}>
                            <div><strong>Fonte:</strong> {row.src}</div>
                            <div><strong>Regra:</strong> {row.rule}</div>
                            <div><strong>Atualização:</strong> {row.at}</div>
                            <div><strong>Observação:</strong> {row.obs}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Desktop Transparent Table */
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, textAlign: 'left', minWidth: 600 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: 9 }}>
                            <th style={{ padding: '6px 8px' }}>Campo</th>
                            <th style={{ padding: '6px 8px' }}>Valor Exibido</th>
                            <th style={{ padding: '6px 8px' }}>Fonte</th>
                            <th style={{ padding: '6px 8px' }}>Regra</th>
                            <th style={{ padding: '6px 8px' }}>Atualização</th>
                            <th style={{ padding: '6px 8px' }}>Qualidade</th>
                            <th style={{ padding: '6px 8px' }}>Observação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { field: 'Nome', val: 'Reforço Estrutural — Ponte Atlântica', src: 'Exemplo: fonte de obras', rule: 'Nome no exemplo de protótipo', at: '15/07/2026', q: 'Demonstrativo', obs: 'Exemplo de visualização' },
                            { field: 'Município/UF', val: 'Niterói / RJ', src: 'Exemplo: referência geográfica', rule: 'Cruzamento de malha municipal', at: '15/07/2026', q: 'Demonstrativo', obs: 'Exemplo de coordenada' },
                            { field: 'Coordenada', val: '-22.8800, -43.1100', src: 'Exemplo: referência geográfica', rule: 'Geo-referenciamento vetorial', at: '10/06/2026', q: 'Demonstrativo', obs: 'Exemplo de precisão geográfica' },
                            { field: 'Empresa', val: 'Consórcio Infraestrutura Exemplo S.A.', src: 'Exemplo: cadastro empresarial', rule: 'Chave empresarial simulada', at: '12/02/2026', q: 'Demonstrativo', obs: 'EXEMPLO DE CONFIRMADO' },
                            { field: 'CNPJ', val: 'XX.XXX.XXX/0001-XX', src: 'Exemplo: cadastro empresarial', rule: 'CNPJ ilustrativo', at: '12/02/2026', q: 'Demonstrativo', obs: 'CNPJ ilustrativo' },
                            { field: 'Fase', val: 'Execução', src: 'Exemplo: fonte de obras', rule: 'Status simulado de acompanhamento', at: '15/07/2026', q: 'Demonstrativo', obs: 'Aderente no exemplo' },
                            { field: 'Status', val: 'Em andamento', src: 'Exemplo: fonte de obras', rule: 'Boletim demonstrativo', at: '15/07/2026', q: 'Demonstrativo', obs: 'Aderente no exemplo' },
                            { field: 'CAPEX', val: 'R$ 47,2M', src: 'Exemplo: fonte de obras', rule: 'Orçamento homologado no protótipo', at: '10/05/2026', q: 'Demonstrativo', obs: 'Homologado (Simulado)' },
                            { field: 'Oportunidades', val: '4 matches', src: 'Exemplo: algoritmo de match', rule: 'Proximidade & Aderência', at: '02/07/2026', q: 'Demonstrativo', obs: 'EXEMPLO DE PROVÁVEL' },
                          ].map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                              <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{row.field}</td>
                              <td style={{ padding: '6px 8px' }}>{row.val}</td>
                              <td style={{ padding: '6px 8px' }}>{row.src}</td>
                              <td style={{ padding: '6px 8px' }}>{row.rule}</td>
                              <td style={{ padding: '6px 8px' }}>{row.at}</td>
                              <td style={{ padding: '6px 8px', color: '#22C55E', fontWeight: 600 }}>{row.q}</td>
                              <td style={{ padding: '6px 8px', color: 'var(--text-tertiary)' }}>{row.obs}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Bloco Explicativo de Classificação Simulado */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 0, marginBottom: 10 }}>
                    Como este vínculo foi classificado no protótipo?
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
                    <div style={{ background: 'var(--bg-base)', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ marginBottom: 4 }}><SemanticBadge type="EXEMPLO DE CONFIRMADO" /></div>
                      <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0 }}>
                        Simulação de chave documental explícita (CNPJ ilustrativo ou chave empresarial demonstrativa).
                      </p>
                    </div>
                    <div style={{ background: 'var(--bg-base)', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ marginBottom: 4 }}><SemanticBadge type="EXEMPLO DE PROVÁVEL" /></div>
                      <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0 }}>
                        Recomendação algorítmica de fornecedores e score de oportunidade simulado por regras demonstrativas.
                      </p>
                    </div>
                    <div style={{ background: 'var(--bg-base)', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ marginBottom: 4 }}><SemanticBadge type="EXEMPLO DE POTENCIAL" /></div>
                      <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0 }}>
                        Coincidência de município ou proximidade territorial demonstrativa entre os cadastros.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>

        {/* ── Footer ── */}
        <div style={{ padding: '8px 24px', borderTop: '1px solid var(--border-subtle)', fontSize: 9, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          WiNS Hub Mockups v2 · Página 05 — Engenharia · Detalhe da Obra · Nenhuma chamada a API real · Ambiente isolado de prototipação
        </div>
      </div>
    </div>
  );
}
