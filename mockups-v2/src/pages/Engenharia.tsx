import React, { useState, useEffect } from 'react';
import {
  HardHat, Tractor, Truck, Stethoscope, Building2, Target,
  MapPin, FileText, ArrowUpRight, CheckCircle2,
  Search, RotateCcw, ChevronRight, BarChart3, Menu, X,
  LayoutDashboard, Share2, Map as MP, LogOut, ShieldCheck,
  Bell, Sun, XCircle, SlidersHorizontal, Filter, ChevronDown,
  ChevronUp, AlertTriangle, DollarSign, Home, Users,
  Briefcase, UserCheck, Globe, Layers, EyeOff, ChevronLeft,
  Calendar, FolderOpen, List, Table, Download, Save, Bookmark,
  HelpCircle, Info, TrendingUp, MapPinned, Network
} from 'lucide-react';
import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/* ─── Constants ──────────────────────────────── */
const ENG_COLOR = '#3B82F6';
const VERT_COLORS = {
  engenharia: '#3B82F6', agro: '#22C55E', logistica: '#F59E0B',
  saude: '#EC4899', oportunidades: '#8B5CF6',
} as const;
const BRAZIL_BOUNDS: [[number, number], [number, number]] = [[-34, -74], [5, -34]];
const DESKTOP_CENTER: [number, number] = [-15.5, -55];
const STATE_LABELS = [
  { uf: 'SP', lat: -22.2, lng: -48.0 }, { uf: 'MG', lat: -18.5, lng: -44.0 },
  { uf: 'RJ', lat: -22.0, lng: -42.5 }, { uf: 'BA', lat: -12.5, lng: -41.5 },
  { uf: 'RS', lat: -30.0, lng: -53.0 }, { uf: 'SC', lat: -27.5, lng: -50.5 },
  { uf: 'PR', lat: -25.0, lng: -52.0 }, { uf: 'PE', lat: -8.5, lng: -37.5 },
  { uf: 'CE', lat: -5.0, lng: -39.5 }, { uf: 'PA', lat: -4.0, lng: -53.0 },
  { uf: 'MT', lat: -12.0, lng: -56.0 }, { uf: 'GO', lat: -16.5, lng: -50.0 },
  { uf: 'MA', lat: -5.5, lng: -45.0 }, { uf: 'AM', lat: -4.0, lng: -64.0 },
  { uf: 'ES', lat: -19.5, lng: -40.5 },
];

/* ─── helpers ────────────────────────────────── */
function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace('.', ',') + ' mil';
  return String(n);
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

/* ─── Data ───────────────────────────────────── */
const kpis = [
  { label: 'Obras visíveis', value: '16.633', sub: '35.690 registros físicos', icon: HardHat, color: ENG_COLOR },
  { label: 'CAPEX homologado', value: 'R$ 243,5 bi', sub: '3.146 obras com valor homologado', icon: DollarSign, color: VERT_COLORS.agro },
  { label: 'Municípios cobertos', value: '2.463', sub: 'presença territorial identificada', icon: MapPin, color: ENG_COLOR },
  { label: 'Empresas vinculadas', value: '4.911', sub: 'empresas identificadas no recorte', icon: Building2, color: VERT_COLORS.oportunidades },
  { label: 'Oportunidades no recorte', value: '641.968', sub: 'score ≥ 70 vinculado às obras visíveis', icon: Target, color: VERT_COLORS.logistica },
  { label: 'Obras sem município', value: '7.089', sub: 'requerem saneamento territorial', icon: Home, color: '#EF4444' },
  { label: 'Obras sem empresa', value: '4.220', sub: 'sem CNPJ empresarial identificado', icon: Users, color: '#F97316' },
  { label: 'Obras sem CAPEX homologado', value: '13.487', sub: 'obras sem valor homologado', icon: EyeOff, color: '#6B7280' },
];

const obrasData = [
  { obra: 'Reforço Ponte Rio-Niterói', mun: 'Niterói', uf: 'RJ', empresa: 'Consórcio Ponte S.A.', fase: 'Execução', capex: 'R$ 47,2 M', oport: 'Fiscalização', qual: 'Completo', qualCor: '#22C55E' },
  { obra: 'Duplicação BR-101 Sul', mun: 'Araranguá', uf: 'SC', empresa: 'Via Sul Engenharia', fase: 'Execução', capex: 'R$ 183,5 M', oport: 'Fornecimento', qual: 'Município ausente', qualCor: '#F97316' },
  { obra: 'Nova Estação Metrô SP', mun: '', uf: 'SP', empresa: 'Metrô SP', fase: 'Planejamento', capex: 'R$ 320,0 M', oport: 'Projetos', qual: 'Empresa ausente', qualCor: '#EF4444' },
  { obra: 'Hospital Regional BA', mun: 'Feira de Santana', uf: 'BA', empresa: '', fase: 'Projeto', capex: 'R$ 0', oport: 'Equipamentos', qual: 'Empresa ausente', qualCor: '#EF4444' },
  { obra: 'Contorno Viário Florianópolis', mun: 'São José', uf: 'SC', empresa: 'ViaSC Concessões', fase: 'Execução', capex: 'R$ 245,8 M', oport: 'Serviços', qual: 'Completo', qualCor: '#22C55E' },
  { obra: 'Usina Hidrelétrica PA', mun: 'Altamira', uf: 'PA', empresa: 'Norte Energia S.A.', fase: 'Execução', capex: 'R$ 580,0 M', oport: 'Manutenção', qual: 'CAPEX homologado', qualCor: '#22C55E' },
  { obra: 'Saneamento Básico PE', mun: '', uf: 'PE', empresa: '', fase: 'Licitação', capex: 'R$ 0', oport: 'Obras civis', qual: 'Múltiplas lacunas', qualCor: '#EF4444' },
  { obra: 'Terminal Portuário Santos', mun: 'Santos', uf: 'SP', empresa: 'Porto de Santos S.A.', fase: 'Projeto', capex: 'R$ 1,2 bi', oport: 'Logística', qual: 'Dados completos', qualCor: '#22C55E' },
];

const fases = [
  { label: 'Execução', value: 42, color: ENG_COLOR },
  { label: 'Planejamento', value: 18, color: '#22C55E' },
  { label: 'Projeto', value: 15, color: '#F59E0B' },
  { label: 'Concluída', value: 8, color: '#6B7280' },
  { label: 'Não informada', value: 17, color: '#4A5A74' },
];

const coverage = { homologado: 3146, semValor: 13487, total: 16633, pct: 18.91 };
const cadastro = { comMun: 9544, semMun: 7089, comEmp: 12413, semEmp: 4220, comCapex: 3146, semCapex: 13487 };

const maiorInvestimento = [
  { obra: 'Usina Hidrelétrica PA', capex: 'R$ 580,0 M', empresa: 'Norte Energia S.A.' },
  { obra: 'Terminal Portuário Santos', capex: 'R$ 1,2 bi', empresa: 'Porto de Santos S.A.' },
  { obra: 'Nova Estação Metrô SP', capex: 'R$ 320,0 M', empresa: 'Metrô SP' },
];
const oportunidadesScore = [
  { obra: 'Reforço Ponte Rio-Niterói', score: 92, tipo: 'Fiscalização', empresa: 'Consórcio Ponte S.A.' },
  { obra: 'Duplicação BR-101 Sul', score: 88, tipo: 'Fornecimento de insumos', empresa: 'Via Sul Engenharia' },
  { obra: 'Contorno Viário Florianópolis', score: 85, tipo: 'Serviços de topografia', empresa: 'ViaSC Concessões' },
];
const rankingMunicipios = [
  { mun: 'São Paulo', obras: 128, capex: 'R$ 2,4 bi' },
  { mun: 'Rio de Janeiro', obras: 94, capex: 'R$ 1,8 bi' },
  { mun: 'Belo Horizonte', obras: 67, capex: 'R$ 980 M' },
];
const itensAtencao = [
  { label: 'Obras sem município', value: 7089, color: '#EF4444' },
  { label: 'Obras sem empresa', value: 4220, color: '#F97316' },
  { label: 'CAPEX não homologado', value: 13487, color: '#6B7280' },
  { label: 'Dados desatualizados (>90d)', value: 2841, color: '#F59E0B' },
];

const mapClusters = [
  { lat: -22.2, lng: -44.5, obras: 6530, empresas: 2174, oportunidades: 53280, label: 'SP+MG+RJ' },
  { lat: -12.97, lng: -38.50, obras: 1289, empresas: 341, oportunidades: 9120, label: 'BA' },
  { lat: -30.03, lng: -51.23, obras: 1127, empresas: 421, oportunidades: 7890, label: 'RS' },
];

const connections = [
  { origem: 'Reforço Ponte Rio-Niterói', destino: 'Consórcio Ponte S.A.', regra: 'CNPJ executora (contrato)', classe: 'CONFIRMADO', cor: VERT_COLORS.agro, fonte: 'DNIT-SICRO 2026', atualizacao: 'Jul/2026' },
  { origem: 'Reforço Ponte Rio-Niterói', destino: 'Mecânica Nacional Ltda.', regra: 'Match setorial score 91', classe: 'PROVÁVEL', cor: VERT_COLORS.logistica, fonte: 'Algoritmo de recomendação', atualizacao: 'Jul/2026' },
  { origem: 'Consórcio Ponte S.A.', destino: 'Carlos M. — Diretor de Obras', regra: 'Vínculo societário RFB', classe: 'CONFIRMADO', cor: VERT_COLORS.agro, fonte: 'Receita Federal', atualizacao: 'Jun/2026' },
  { origem: 'Niterói / RJ', destino: '12 obras · 8 empresas · 142 oportunidades', regra: 'Coincidência municipal', classe: 'POTENCIAL', cor: ENG_COLOR, fonte: 'Malha territorial WiNS', atualizacao: 'Jul/2026' },
];

/* ─── FitBounds ──────────────────────────────── */
function FitBoundsControl({ mapRef, isMobile, isTablet }: {
  mapRef: React.MutableRefObject<L.Map | null>; isMobile: boolean; isTablet: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    const center = isMobile ? [-14, -48] : (isTablet ? [-15, -50] : DESKTOP_CENTER);
    const zoom = isMobile ? 4 : 5;
    map.setView(center, zoom);
    (window as any).__mapCenter = center;
    (window as any).__mapZoom = zoom;
    map.on('zoomend', () => { (window as any).__mapZoom = map.getZoom(); });
  }, []);
  return null;
}

/* ─── KpiCard ────────────────────────────────── */
function KpiCard({ kpi, mobile, onClick }: {
  kpi: typeof kpis[0]; mobile?: boolean; onClick: () => void;
}) {
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)', padding: mobile ? 10 : 16,
        display: 'flex', flexDirection: 'column', gap: mobile ? 2 : 4,
        cursor: 'pointer', transition: 'all var(--transition-fast)',
        outline: 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = kpi.color; e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
      onFocus={e => { e.currentTarget.style.borderColor = kpi.color; }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mobile ? 2 : 4 }}>
        <span style={{ fontSize: mobile ? 10 : 11, fontWeight: 500, color: 'var(--text-secondary)' }}>{kpi.label}</span>
        <div style={{ width: mobile ? 22 : 28, height: mobile ? 22 : 28, borderRadius: 6, background: `${kpi.color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <kpi.icon size={mobile ? 11 : 14} color={kpi.color} />
        </div>
      </div>
      <span style={{ fontSize: mobile ? 16 : 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>{kpi.value}</span>
      <span style={{ fontSize: mobile ? 9 : 10, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{kpi.sub}</span>
    </div>
  );
}

/* ─── Main ───────────────────────────────────── */
export default function Engenharia() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1199px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [selectedFase, setSelectedFase] = useState('');
  const [selectedUf, setSelectedUf] = useState('');
  const [selectedMun, setSelectedMun] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filterCount = [selectedFase, selectedUf, selectedMun, selectedStatus, ...(searchQuery ? [searchQuery] : [])].filter(Boolean).length;
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2800); };

  const mainPad = isMobile ? 12 : 24;
  const kpiCols = isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
  const contentCols = isMobile ? '1fr' : (isTablet ? '1fr' : '1fr 380px');
  const priorCols = isMobile ? '1fr' : (isTablet ? '1fr 1fr' : 'repeat(4, 1fr)');
  const connCols = isMobile ? '1fr' : (isTablet ? '1fr 1fr' : 'repeat(4, 1fr)');

  const navItems = [
    { icon: LayoutDashboard, label: 'Visão Geral', route: '/visao-geral', active: false },
    { icon: HardHat, label: 'Engenharia', route: '/engenharia', active: true },
    { icon: Tractor, label: 'Agro', route: '/engenharia', active: false },
    { icon: Truck, label: 'Logística', route: '/engenharia', active: false },
    { icon: Stethoscope, label: 'Saúde', route: '/engenharia', active: false },
    { icon: Share2, label: 'Relacionamentos', route: '/engenharia', active: false },
    { icon: Building2, label: 'Empresa 360°', route: '/engenharia', active: false },
    { icon: MP, label: 'Inteligência Territorial', route: '/engenharia', active: false },
    { icon: Search, label: 'Busca Global', route: '/engenharia', active: false },
  ];

  const actionBtns = [
    { label: 'Ver obras', icon: HardHat },
    { label: 'Fornecedores', icon: Truck },
    { label: 'Decisores', icon: UserCheck },
    { label: 'Empresas', icon: Building2 },
    { label: 'Oportunidades', icon: Target },
    { label: 'Explorar mapa', icon: MP },
  ];

  const clearFilters = () => { setSelectedFase(''); setSelectedUf(''); setSelectedMun(''); setSelectedStatus(''); setSearchQuery(''); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
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

      {/* ── Sidebar ── */}
      {isMobile ? (
        <>
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: 200,
            opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'auto' : 'none',
            transition: 'opacity 0.2s',
          }} onClick={() => setSidebarOpen(false)} />
          <aside style={{
            position: 'fixed', top: 0, left: 0, height: '100vh', width: 280,
            background: 'var(--bg-sidebar)', zIndex: 201,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease',
            display: 'flex', flexDirection: 'column',
            borderRight: '1px solid var(--border-default)',
            overflow: 'hidden',
          }}>
            <MobileSidebarContent navItems={navItems} onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      ) : (
        <DesktopSidebar navItems={navItems} />
      )}

      {/* ── Main ── */}
      <div style={{
        marginLeft: isMobile ? 0 : 'var(--sidebar-w)',
        flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
        maxWidth: '100vw',
      }}>
        {/* ── Topbar ── */}
        <header style={{
          background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div style={{
            height: 'var(--topbar-h)', display: 'flex', alignItems: 'center',
            padding: isMobile ? '0 12px' : '0 24px', gap: isMobile ? 8 : 16,
          }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
                <Menu size={20} />
              </button>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Engenharia</h1>
              {!isMobile && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>Carteira de obras, empresas, decisores e oportunidades</p>}
            </div>
            <div style={{ position: 'relative', width: isMobile ? 140 : 240, flexShrink: 0 }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input placeholder={isMobile ? 'Buscar…' : 'Buscar no WiNS Hub…'} style={{
                width: '100%', height: 32, paddingLeft: 28, fontSize: 11,
                background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
              }} />
            </div>
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
                <Calendar size={13} /><span>Jul 2026</span><ChevronDown size={10} />
              </div>
            )}
            {!isMobile && (
              <button style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Sun size={14} />
              </button>
            )}
            <button style={{ position: 'relative', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Bell size={14} />
              <span style={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-blue)' }} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', flexShrink: 0 }}>
              <div style={{ width: isMobile ? 26 : 28, height: isMobile ? 26 : 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), #6C5CE7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>W</div>
            </div>
          </div>

          {/* ── Action bar ── */}
          {!isMobile ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 24px 8px',
              borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap',
            }}>
              {actionBtns.map(b => (
                <button key={b.label} onClick={() => showToast(`🔧 ${b.label} — disponível na próxima fase de prototipação`)} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', fontSize: 11, fontWeight: 500,
                  background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all var(--transition-fast)',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = ENG_COLOR; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-base)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                >
                  <b.icon size={13} />
                  {b.label}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setActionsOpen(true)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 11, fontWeight: 500,
                background: `${ENG_COLOR}18`, border: `1px solid ${ENG_COLOR}44`, borderRadius: 'var(--radius-sm)',
                color: ENG_COLOR, cursor: 'pointer', width: '100%', justifyContent: 'center',
              }}>
                <ChevronUp size={13} /> Ações
              </button>
            </div>
          )}

          {/* ── Mobile actions bottom sheet ── */}
          {isMobile && actionsOpen && (
            <>
              <div style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998,
              }} onClick={() => setActionsOpen(false)} />
              <div role="dialog" aria-label="Ações da vertical" style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
                background: 'var(--bg-surface)', borderTopLeftRadius: 'var(--radius-lg)',
                borderTopRightRadius: 'var(--radius-lg)', padding: '16px 20px',
                display: 'flex', flexDirection: 'column', gap: 4,
                boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
              }}
                onKeyDown={e => { if (e.key === 'Escape') setActionsOpen(false); }}
                tabIndex={0}
                ref={el => { if (el) setTimeout(() => el.focus(), 50); }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Ações da vertical</span>
                  <button onClick={() => setActionsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}>
                    <X size={18} />
                  </button>
                </div>
                {actionBtns.map(b => (
                  <button key={b.label} onClick={() => { setActionsOpen(false); showToast(`🔧 ${b.label} — disponível na próxima fase de prototipação`); }} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', width: '100%', textAlign: 'left',
                    transition: 'background var(--transition-fast)',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    <b.icon size={16} color={ENG_COLOR} />
                    {b.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </header>

        <main style={{
          flex: 1, padding: mainPad, overflowY: 'auto', overflowX: 'hidden',
          maxWidth: isMobile ? '100%' : 1680, width: '100%', margin: '0 auto',
        }}>
          {/* ── 1. KPIs ── */}
          <div style={{ display: 'grid', gridTemplateColumns: kpiCols, gap: isMobile ? 8 : 12, marginBottom: 14 }}>
            {kpis.map(k => (
              <KpiCard key={k.label} kpi={k} mobile={isMobile} onClick={() => showToast(`📊 ${k.label}: ${k.value} — detalhamento disponível na próxima fase`)} />
            ))}
          </div>

          {/* ── 2. Filters ── */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <Filter size={13} color={ENG_COLOR} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Filtros da carteira</span>
              {filterCount > 0 && (
                <span style={{ fontSize: 10, padding: '1px 6px', background: `${ENG_COLOR}22`, color: ENG_COLOR, borderRadius: 8, fontWeight: 600 }}>{filterCount} ativo(s)</span>
              )}
            </div>

            {/* Main filters */}
            <div style={{ display: 'flex', gap: 6, padding: '10px 14px', flexWrap: 'wrap', borderBottom: advancedOpen ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ flex: '1 1 180px', minWidth: 120, position: 'relative' }}>
                <Search size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input placeholder="Buscar obra, empresa, CNPJ…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', height: 28, paddingLeft: 22, fontSize: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
              </div>
              <select value={selectedUf} onChange={e => setSelectedUf(e.target.value)}
                style={{ flex: '0 0 auto', fontSize: 10, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', maxWidth: 80 }}>
                <option value="">UF: Todas</option>
                {['SP','MG','RJ','BA','RS','SC','PR','PE','CE','PA'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <select value={selectedMun} onChange={e => setSelectedMun(e.target.value)}
                style={{ flex: '0 0 auto', fontSize: 10, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', maxWidth: 110 }}>
                <option value="">Município: Todos</option>
                <option value="sp">São Paulo</option><option value="rj">Rio de Janeiro</option>
                <option value="bh">Belo Horizonte</option><option value="poa">Porto Alegre</option>
                <option value="salvador">Salvador</option><option value="bsb">Brasília</option>
              </select>
              <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}
                style={{ flex: '0 0 auto', fontSize: 10, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', maxWidth: 110 }}>
                <option value="">Status: Todos</option>
                <option value="execucao">Em execução</option><option value="planejamento">Planejamento</option>
                <option value="projeto">Projeto</option><option value="concluida">Concluída</option>
              </select>
              <select value={selectedFase} onChange={e => setSelectedFase(e.target.value)}
                style={{ flex: '0 0 auto', fontSize: 10, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', maxWidth: 110 }}>
                <option value="">Fase: Todas</option>
                <option value="execucao">Execução</option><option value="planejamento">Planejamento</option>
                <option value="projeto">Projeto</option><option value="licitacao">Licitação</option>
              </select>
              <button onClick={() => setAdvancedOpen(!advancedOpen)} style={{
                display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', fontSize: 10,
                background: advancedOpen ? `${ENG_COLOR}22` : 'var(--bg-base)',
                border: '1px solid var(--border-subtle)', borderRadius: 4,
                color: advancedOpen ? ENG_COLOR : 'var(--text-tertiary)', cursor: 'pointer',
              }}>
                <SlidersHorizontal size={10} />
                Avançados {advancedOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            </div>

            {/* Advanced filters */}
            {advancedOpen && (
              <div style={{
                display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (isTablet ? '1fr 1fr 1fr' : 'repeat(4, 1fr)'),
                gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
              }}>
                {[
                  { label: 'Setor', options: ['Todos', 'Infraestrutura', 'Energia', 'Saneamento', 'Transporte'] },
                  { label: 'Empresa / CNPJ', type: 'text' },
                  { label: 'CAPEX mínimo', type: 'text' },
                  { label: 'CAPEX máximo', type: 'text' },
                  { label: 'Data inicial', type: 'date' },
                  { label: 'Data final', type: 'date' },
                ].map(f => (
                  <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{f.label}</span>
                    {f.type === 'date' ? (
                      <input type="date" style={{ height: 26, fontSize: 10, padding: '2px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
                    ) : f.options ? (
                      <select style={{ height: 26, fontSize: 10, padding: '2px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                        {f.options.map(o => <option key={o} value={o}>{o === 'Todos' ? `${f.label}: Todos` : o}</option>)}
                      </select>
                    ) : (
                      <input placeholder={`Ex: ${f.label === 'Empresa / CNPJ' ? '12.345.678/0001-00' : ''}`} style={{ height: 26, fontSize: 10, padding: '2px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)' }} />
                    )}
                  </div>
                ))}
                {isMobile ? (
                  <>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Com fornecedor recomendado</span>
                      <input type="checkbox" style={{ accentColor: ENG_COLOR }} />
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Com decisor</span>
                      <input type="checkbox" style={{ accentColor: ENG_COLOR }} />
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Com oportunidade</span>
                      <input type="checkbox" style={{ accentColor: ENG_COLOR }} />
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>CAPEX homologado</span>
                      <input type="checkbox" style={{ accentColor: ENG_COLOR }} />
                    </div>
                  </>
                ) : (
                  ['Com fornecedor recomendado', 'Com decisor', 'Com oportunidade', 'CAPEX homologado'].map(cb => (
                    <div key={cb} style={{ display: 'flex', gap: 4, alignItems: 'center', paddingTop: 14 }}>
                      <input type="checkbox" id={cb} style={{ accentColor: ENG_COLOR }} />
                      <label htmlFor={cb} style={{ fontSize: 9, color: 'var(--text-tertiary)', cursor: 'pointer' }}>{cb}</label>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', flexWrap: 'wrap' }}>
              <button onClick={() => showToast('✅ Filtros aplicados — funcionalidade disponível na próxima fase')} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 10, fontWeight: 600,
                background: ENG_COLOR, color: '#fff', borderRadius: 4, border: 'none', cursor: 'pointer',
              }}>
                <CheckCircle2 size={11} /> Aplicar filtros
              </button>
              <button onClick={clearFilters} style={{
                display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', fontSize: 10,
                background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 4,
                color: 'var(--text-tertiary)', cursor: 'pointer',
              }}>
                <XCircle size={10} /> Limpar
              </button>
              <button onClick={() => showToast('💾 Visão salva — funcionalidade disponível na próxima fase')} style={{
                display: 'flex', alignItems: 'center', gap: 3, padding: '4px 8px', fontSize: 10,
                background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 4,
                color: 'var(--text-tertiary)', cursor: 'pointer',
              }}>
                <Save size={10} /> Salvar visão
              </button>
            </div>
          </div>

          {/* ── 3. Content 65/35 ── */}
          <div style={{ display: 'grid', gridTemplateColumns: contentCols, gap: 14, marginBottom: 14 }}>
            {/* 3a. Works list */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {isMobile ? (
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <HardHat size={14} color={ENG_COLOR} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Obras prioritárias do recorte</span>
                    <div style={{ display: 'flex', gap: 2, border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 1 }}>
                      <button style={{ padding: '2px 5px', background: 'var(--accent-blue-bg)', borderRadius: 3, border: 'none', cursor: 'pointer', color: ENG_COLOR }}><List size={12} /></button>
                      <button style={{ padding: '2px 5px', background: 'transparent', borderRadius: 3, border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><Table size={12} /></button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{obrasData.length} resultados</span>
                    <button onClick={() => showToast('📂 Diretório completo — disponível na próxima fase')} style={{
                      display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', fontSize: 10,
                      background: `${ENG_COLOR}18`, border: 'none', borderRadius: 4, color: ENG_COLOR, cursor: 'pointer', fontWeight: 500,
                    }}>
                      <FolderOpen size={11} /> Abrir diretório
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <HardHat size={14} color={ENG_COLOR} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Obras prioritárias do recorte</span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{obrasData.length} resultados</span>
                  <div style={{ display: 'flex', gap: 2, border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 1 }}>
                    <button style={{ padding: '2px 5px', background: 'var(--accent-blue-bg)', borderRadius: 3, border: 'none', cursor: 'pointer', color: ENG_COLOR }}><List size={12} /></button>
                    <button style={{ padding: '2px 5px', background: 'transparent', borderRadius: 3, border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><Table size={12} /></button>
                  </div>
                  <button onClick={() => showToast('📂 Diretório completo — disponível na próxima fase')} style={{
                    display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', fontSize: 10,
                    background: `${ENG_COLOR}18`, border: 'none', borderRadius: 4, color: ENG_COLOR, cursor: 'pointer', fontWeight: 500,
                  }}>
                    <FolderOpen size={11} /> Abrir diretório
                  </button>
                </div>
              )}

              {isMobile ? (
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {obrasData.slice(0, 6).map((o, i) => (
                    <div key={i} style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', padding: 10, border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{o.obra}</span>
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: o.qualCor + '22', color: o.qualCor, fontWeight: 500 }}>{o.qual}</span>
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', display: 'flex', gap: 8 }}>
                        <span>{o.mun || '—'} / {o.uf}</span>
                        <span>{o.empresa || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
                        <span style={{ color: o.fase === 'Execução' ? '#22C55E' : 'var(--text-secondary)' }}>{o.fase}</span>
                        <span style={{ color: o.capex === 'R$ 0' ? 'var(--text-disabled)' : 'var(--text-primary)', fontWeight: 600 }}>{o.capex}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ overflowX: 'auto', fontSize: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {['Obra', 'Município/UF', 'Empresa', 'Fase', 'CAPEX', 'Oportunidade', 'Qualidade', ''].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text-tertiary)', fontWeight: 500, fontSize: 9, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {obrasData.map((o, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background var(--transition-fast)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '7px 10px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{o.obra}</td>
                          <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{o.mun || '—'} / {o.uf}</td>
                          <td style={{ padding: '7px 10px', color: o.empresa ? 'var(--text-secondary)' : 'var(--text-disabled)' }}>{o.empresa || '—'}</td>
                          <td style={{ padding: '7px 10px', color: o.fase === 'Execução' ? '#22C55E' : 'var(--text-secondary)' }}>{o.fase}</td>
                          <td style={{ padding: '7px 10px', fontWeight: 600, whiteSpace: 'nowrap', color: o.capex === 'R$ 0' ? 'var(--text-disabled)' : 'var(--text-primary)' }}>{o.capex}</td>
                          <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{o.oport}</td>
                          <td style={{ padding: '7px 10px' }}>
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: o.qualCor + '22', color: o.qualCor }}>{o.qual}</span>
                          </td>
                          <td style={{ padding: '7px 10px' }}>
                            <button onClick={() => showToast(`🔍 ${o.obra} — detalhamento disponível na próxima fase`)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}>
                              <ArrowUpRight size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Exibindo 1-8 de 16.633 resultados</span>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button style={{ padding: '2px 6px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 3, color: 'var(--text-tertiary)', cursor: 'pointer' }}><ChevronLeft size={10} /></button>
                  <button style={{ padding: '2px 6px', fontSize: 9, background: `${ENG_COLOR}22`, border: `1px solid ${ENG_COLOR}`, borderRadius: 3, color: ENG_COLOR, cursor: 'pointer', fontWeight: 600 }}>1</button>
                  <button style={{ padding: '2px 6px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 3, color: 'var(--text-tertiary)', cursor: 'pointer' }}>2</button>
                  <button style={{ padding: '2px 6px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 3, color: 'var(--text-tertiary)', cursor: 'pointer' }}>3</button>
                  <span style={{ padding: '2px 4px', fontSize: 9, color: 'var(--text-disabled)' }}>…</span>
                  <button style={{ padding: '2px 6px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 3, color: 'var(--text-tertiary)', cursor: 'pointer' }}>2079</button>
                  <button style={{ padding: '2px 6px', fontSize: 9, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 3, color: 'var(--text-tertiary)', cursor: 'pointer' }}><ChevronRight size={10} /></button>
                </div>
              </div>
            </div>

            {/* 3b. Context panel */}
            {!isMobile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Phase distribution */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <BarChart3 size={13} color={ENG_COLOR} /> Distribuição por fase
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {fases.map(f => (
                      <div key={f.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{f.label}</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{f.value}%</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${f.value}%`, height: '100%', background: f.color, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial coverage */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <DollarSign size={13} color="#22C55E" /> Cobertura financeira
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#22C55E' }}>R$ 243,5 bi</div>
                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>CAPEX homologado</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{coverage.pct}%</div>
                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>cobertura</div>
                    </div>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-base)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${coverage.pct}%`, height: '100%', background: '#22C55E', borderRadius: 4 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-tertiary)' }}>
                    <span>{fmt(coverage.homologado)} obras com valor</span>
                    <span>{fmt(coverage.semValor)} sem valor</span>
                  </div>
                </div>

                {/* Cadastral quality */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircle2 size={13} color={ENG_COLOR} /> Qualidade cadastral
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[
                      { label: 'Com município', value: cadastro.comMun, total: 16633, color: '#22C55E' },
                      { label: 'Sem município', value: cadastro.semMun, total: 16633, color: '#EF4444' },
                      { label: 'Com empresa', value: cadastro.comEmp, total: 16633, color: '#22C55E' },
                      { label: 'Sem empresa', value: cadastro.semEmp, total: 16633, color: '#F97316' },
                      { label: 'CAPEX homologado', value: cadastro.comCapex, total: 16633, color: '#22C55E' },
                      { label: 'Sem CAPEX', value: cadastro.semCapex, total: 16633, color: '#6B7280' },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 20, textAlign: 'right', fontSize: 10, fontWeight: 600, color: r.color }}>{((r.value / r.total) * 100).toFixed(0)}%</div>
                        <div style={{ flex: 1, height: 5, background: 'var(--bg-base)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${(r.value / r.total) * 100}%`, height: '100%', background: r.color, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', minWidth: 80 }}>{r.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── 4. Executive Prioritization ── */}
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={15} color={ENG_COLOR} /> Priorização executiva
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 400 }}>— Dados ilustrativos para validação de layout</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: priorCols, gap: 12, marginBottom: 16 }}>
            {/* 4a. Maiores investimentos */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 14 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <DollarSign size={13} color="#22C55E" /> Maiores investimentos
              </h3>
              {maiorInvestimento.map((m, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: i < maiorInvestimento.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{m.obra}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)' }}>
                    <span>{m.empresa}</span>
                    <span style={{ fontWeight: 700, color: '#22C55E' }}>{m.capex}</span>
                  </div>
                </div>
              ))}
              <button onClick={() => showToast('📊 Maiores investimentos — detalhamento disponível na próxima fase')} style={{
                display: 'flex', alignItems: 'center', gap: 3, marginTop: 6,
                fontSize: 10, color: ENG_COLOR, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>
                Explorar <ArrowUpRight size={10} />
              </button>
            </div>

            {/* 4b. Oportunidades - higher score */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 14 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Target size={13} color={VERT_COLORS.logistica} /> Oportunidades de maior score
              </h3>
              <p style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 6, fontStyle: 'italic' }}>
                Matches PROVÁVEIS — não representam contrato ou fornecimento confirmado.
              </p>
              {oportunidadesScore.map((o, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: i < oportunidadesScore.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{o.obra}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)' }}>
                    <span>{o.tipo}</span>
                    <span style={{ fontWeight: 600, color: VERT_COLORS.logistica }}>Score {o.score}</span>
                  </div>
                </div>
              ))}
              <button onClick={() => showToast('🎯 Oportunidades — detalhamento disponível na próxima fase')} style={{
                display: 'flex', alignItems: 'center', gap: 3, marginTop: 6,
                fontSize: 10, color: ENG_COLOR, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>
                Abrir lista <ArrowUpRight size={10} />
              </button>
            </div>

            {/* 4c. City ranking */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 14 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={13} color={ENG_COLOR} /> Municípios com maior concentração
              </h3>
              {rankingMunicipios.map((m, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: i < rankingMunicipios.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>{m.mun}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>{m.capex}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{m.obras} obras registradas</div>
                </div>
              ))}
              <button onClick={() => showToast('📍 Ranking territorial — detalhamento disponível na próxima fase')} style={{
                display: 'flex', alignItems: 'center', gap: 3, marginTop: 6,
                fontSize: 10, color: ENG_COLOR, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>
                Ver detalhes <ArrowUpRight size={10} />
              </button>
            </div>

            {/* 4d. Attention items */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 14 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle size={13} color="#EF4444" /> Itens que exigem atenção
              </h3>
              {itensAtencao.map(t => (
                <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.color }} />
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{t.label}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.color }}>{fmt(t.value)}</span>
                </div>
              ))}
              <button onClick={() => showToast('⚠️ Itens de atenção — detalhamento disponível na próxima fase')} style={{
                display: 'flex', alignItems: 'center', gap: 3, marginTop: 6,
                fontSize: 10, color: ENG_COLOR, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>
                Ver detalhes <ArrowUpRight size={10} />
              </button>
            </div>
          </div>

          {/* ── 5. Map ── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 280px', gap: 14, marginBottom: 16 }}>
            <section style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <MP size={13} color={ENG_COLOR} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Mapa da carteira</span>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                  Dados ilustrativos para validação visual do mapa.
                </span>
              </div>
              <div style={{ height: isMobile ? 260 : 340, position: 'relative' }}>
                <MapContainer
                  center={DESKTOP_CENTER} zoom={5}
                  scrollWheelZoom={true} style={{ height: '100%', width: '100%', background: '#08111F' }}
                  zoomControl={false} maxBounds={BRAZIL_BOUNDS} maxBoundsViscosity={1} worldCopyJump={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                  {mapClusters.map(c => (
                    <CircleMarker key={c.label}
                      center={[c.lat, c.lng]} radius={isMobile ? 12 : 16}
                      pathOptions={{ color: ENG_COLOR, fillColor: ENG_COLOR, fillOpacity: 0.3, weight: 2 }}
                    >
                      <Tooltip direction="top" offset={[0, -8]}>
                        <div style={{ fontSize: 10, lineHeight: 1.4 }}>
                          <strong>{c.label}</strong><br />
                          Obras: {fmt(c.obras)} · Empresas: {fmt(c.empresas)}<br />
                          Oportunidades: {fmt(c.oportunidades)}
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  ))}
                  {STATE_LABELS.map(s => (
                    <Marker key={s.uf} position={[s.lat, s.lng]}
                      icon={L.divIcon({
                        className: '', iconSize: [0, 0],
                        html: `<span style="font-size:${isMobile ? 8 : 10}px;font-weight:500;color:#8B9DC4AA;font-family:Inter,sans-serif;text-shadow:0 0 4px #08111F,0 0 8px #08111F;white-space:nowrap;letter-spacing:0.6px;pointer-events:none">${s.uf}</span>`,
                      })}
                    />
                  ))}
                </MapContainer>
                <div style={{
                  position: 'absolute', bottom: 8, left: 8, zIndex: 1000,
                  background: 'rgba(8,17,31,0.92)', padding: '4px 8px',
                  borderRadius: 6, fontSize: 9, color: 'var(--text-tertiary)',
                }}>
                  <span style={{ fontSize: 9, color: 'var(--text-disabled)', fontStyle: 'italic' }}>
                    Dados ilustrativos para validação visual do mapa.
                  </span>
                </div>
              </div>
            </section>

            {/* Map panel */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Resumo da carteira</h3>
              {[
                { label: 'Obras no recorte', value: '16.633', color: ENG_COLOR },
                { label: 'CAPEX homologado', value: 'R$ 243,5 bi', color: '#22C55E' },
                { label: 'Municípios', value: '2.463', color: ENG_COLOR },
                { label: 'Oportunidades', value: '641.968', color: VERT_COLORS.logistica },
                { label: 'Empresas', value: '4.911', color: VERT_COLORS.oportunidades },
                { label: 'Qualidade geográfica', value: '57,4%', color: '#F59E0B' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{r.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 6. Connections ── */}
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Network size={15} color={ENG_COLOR} /> Conexões da carteira
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 400 }}>— Dados ilustrativos para validação de layout</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: connCols, gap: 12, marginBottom: 14 }}>
            {connections.map((c, i) => (
              <div key={i} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: c.cor, background: c.cor + '18', padding: '1px 8px', borderRadius: 8 }}>{c.classe}</span>
                  <span style={{ fontSize: 8, color: 'var(--text-disabled)' }}>{c.atualizacao}</span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>ORIGEM</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>{c.origem}</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>DESTINO</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{c.destino}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{c.regra}</span>
                  <span style={{ fontSize: 8, color: 'var(--text-disabled)' }}>Fonte: {c.fonte}</span>
                </div>
                <button onClick={() => showToast(`🔗 ${c.origem} → ${c.destino} — detalhamento disponível na próxima fase`)} style={{
                  display: 'flex', alignItems: 'center', gap: 3, marginTop: 4,
                  fontSize: 10, color: ENG_COLOR, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}>
                  Ver detalhes <ArrowUpRight size={10} />
                </button>
              </div>
            ))}
          </div>

          {/* ── Footer ── */}
          <footer style={{
            padding: '12px 0', borderTop: '1px solid var(--border-subtle)',
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
            fontSize: 10, color: 'var(--text-disabled)', gap: isMobile ? 4 : 0,
          }}>
            <span>Fontes: DNIT-SICRO, CNES, RNTRC, CAR, Receita Federal · Dados atualizados em Jul/2026</span>
            <span>WiNS Hub — Inteligência Multivertical · v2.0.0-mockup</span>
          </footer>

          {/* ── Disclaimer ── */}
          <div style={{ fontSize: 8, color: 'var(--text-disabled)', marginTop: 4, textAlign: 'center', fontStyle: 'italic' }}>
            Todos os dados, valores, empresas, pessoas e registros apresentados são ilustrativos para validação visual do layout. Nenhuma informação reflete dados oficiais, contratos vigentes ou pessoas reais.
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─── DesktopSidebar ─────────────────────────── */
function DesktopSidebar({ navItems }: { navItems: Array<{ icon: any; label: string; route: string; active: boolean }> }) {
  return (
    <aside style={{
      width: 'var(--sidebar-w)', height: '100vh', background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-default)',
      display: 'flex', flexDirection: 'column', position: 'fixed',
      left: 0, top: 0, zIndex: 100, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--border-default)', minHeight: 64 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent-blue), #6C5CE7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>W</div>
        <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>WiNS Hub</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>Inteligência Multivertical</div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
        {navItems.map(item => (
          <a key={item.label} href={item.route} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px',
            borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500,
            textDecoration: 'none', marginBottom: 2, cursor: 'pointer',
            background: item.active ? 'var(--accent-blue-bg)' : 'transparent',
            color: item.active ? 'var(--accent-blue)' : 'var(--text-secondary)',
            transition: 'all var(--transition-fast)',
          }}
            onMouseEnter={e => { if (!item.active) { e.currentTarget.style.background = 'var(--bg-surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}}
            onMouseLeave={e => { if (!item.active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}}
          >
            <item.icon size={18} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
          </a>
        ))}
      </nav>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-default)', fontSize: 11, color: 'var(--text-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><ShieldCheck size={14} /><span>Homologação</span></div>
        <div style={{ marginBottom: 2 }}>William · Analista</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}><LogOut size={14} /><span>Sair</span></div>
      </div>
    </aside>
  );
}

/* ─── MobileSidebarContent ─────────────────────────── */
function MobileSidebarContent({ navItems, onClose }: { navItems: Array<{ icon: any; label: string; route: string; active: boolean }>; onClose: () => void }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, var(--accent-blue), #6C5CE7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>W</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>WiNS Hub</div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Inteligência Multivertical</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
      </div>
      <nav style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
        {navItems.map(item => (
          <a key={item.label} href={item.route} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px',
            borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500,
            textDecoration: 'none', marginBottom: 2,
            background: item.active ? 'var(--accent-blue-bg)' : 'transparent',
            color: item.active ? 'var(--accent-blue)' : 'var(--text-secondary)',
          }}>
            <item.icon size={18} style={{ flexShrink: 0 }} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-default)', fontSize: 11, color: 'var(--text-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><ShieldCheck size={14} /><span>Homologação</span></div>
        <div style={{ marginBottom: 2 }}>William · Analista</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}><LogOut size={14} /><span>Sair</span></div>
      </div>
    </>
  );
}
