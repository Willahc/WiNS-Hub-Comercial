import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  HardHat, Tractor, Truck, Stethoscope, Building2, Target,
  MapPin, Users, FileText, ArrowUpRight, CheckCircle2,
  Search, RotateCcw,
  ChevronRight, BarChart3, Menu, X,
  LayoutDashboard, Share2, Map as MP, LogOut, ShieldCheck,
  Bell, Sun, XCircle, SlidersHorizontal
} from 'lucide-react';

/* ─── Brazil bounds ──────────────────────────── */
const BRAZIL_BOUNDS: [[number, number], [number, number]] = [[-34, -74], [5, -34]];
const DESKTOP_CENTER: [number, number] = [-15.5, -55];
const TABLET_CENTER: [number, number] = [-15, -50];
const MOBILE_CENTER: [number, number] = [-14, -48];

/* ─── Semantic palette ───────────────────────── */
const VERT_COLORS = {
  engenharia: '#3B82F6',
  agro: '#22C55E',
  logistica: '#F59E0B',
  saude: '#EC4899',
  oportunidades: '#8B5CF6',
} as const;

const VERT_LABELS: Record<string, string> = {
  engenharia: 'Engenharia',
  agro: 'Agro',
  logistica: 'Logística',
  saude: 'Saúde',
  oportunidades: 'Oportunidades',
};

/* ─── helpers ────────────────────────────────── */
function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace('.', ',') + ' mil';
  return String(n);
}

/* ─── data ───────────────────────────────────── */
const kpis = [
  { label: 'Obras visíveis', value: '16.633', sub: 'catálogo físico: 35.690', icon: HardHat, color: VERT_COLORS.engenharia, bg: 'rgba(59,130,246,0.12)' },
  { label: 'Empresas ativas', value: '636.404', sub: 'registros físicos: ~4,8M', icon: Building2, color: VERT_COLORS.oportunidades, bg: 'rgba(139,92,246,0.12)' },
  { label: 'Oportunidades', value: '641.968', sub: 'matches score ≥70: 1.210.670', icon: Target, color: VERT_COLORS.logistica, bg: 'rgba(245,158,11,0.12)' },
  { label: 'Relações documentais confirmadas', value: '133.697', sub: '3.576 selecionadas para destaque', icon: CheckCircle2, color: VERT_COLORS.agro, bg: 'rgba(34,197,94,0.12)' },
  { label: 'Imóveis CAR', value: '852.190', sub: 'físicos: 8.291.331', icon: MapPin, color: VERT_COLORS.agro, bg: 'rgba(34,197,94,0.08)' },
  { label: 'Transportadores', value: '241.920', sub: 'RNTRC físicos: 1.124.684', icon: Truck, color: VERT_COLORS.logistica, bg: 'rgba(245,158,11,0.08)' },
  { label: 'Estabelecimentos CNES', value: '387.410', sub: 'físicos: 623.208', icon: Stethoscope, color: VERT_COLORS.saude, bg: 'rgba(236,72,153,0.12)' },
  { label: 'Relações potenciais', value: '610 / 827', sub: '610 municípios no recorte atual, de 827 com presença nas quatro verticais', icon: Users, color: VERT_COLORS.engenharia, bg: 'rgba(79,124,255,0.12)' },
];

const connections = [
  { label: 'CONFIRMADO', value: '133.697', color: VERT_COLORS.agro, desc: 'Vínculos com chave documental explícita (CNPJ executora × CNPJ mantenedora CNES)' },
  { label: 'PROVÁVEL', value: '1.210.670', color: VERT_COLORS.logistica, desc: 'Match algorítmico score ≥70' },
  { label: 'POTENCIAL', value: '610', color: VERT_COLORS.engenharia, desc: 'Coincidência territorial — sem contrato' },
];

const clusterData = [
  { uf: 'Sudeste', lat: -22.2, lng: -44.5, obras: 6530, empresas: 217430, oportunidades: 324800, vertical: 'oportunidades' as const },
  { uf: 'BA', lat: -12.97, lng: -38.50, obras: 1289, empresas: 34108, oportunidades: 52340, vertical: 'saude' as const },
  { uf: 'RS', lat: -30.03, lng: -51.23, obras: 1127, empresas: 42108, oportunidades: 61230, vertical: 'logistica' as const },
];

const featuredEvent = {
  title: 'Reforço Estrutural — Ponte Rio-Niterói',
  municipio: 'Niterói / RJ',
  fase: 'Execução (DNIT-SICRO)',
  capex: 'R$ 47,2 milhões',
  fonte: 'Ilustrativo — consulta SICRO 2026',
};

const quickActions = [
  { label: 'Explorar mapa', icon: MapPin, route: '#' },
  { label: 'Relatório executivo', icon: FileText, route: '#' },
  { label: 'Busca avançada', icon: Search, route: '#' },
  { label: 'Exportar dados', icon: BarChart3, route: '#' },
];

const crossRelations = [
  { origem: 'Ponte Rio-Niterói', destino: 'Consórcio Ponte S.A.', regra: 'CNPJ executora', classe: 'CONFIRMADO', cor: VERT_COLORS.agro },
  { origem: 'Hosp. das Clínicas SP', destino: 'Governo do Estado de SP', regra: 'Mantenedora CNES', classe: 'CONFIRMADO', cor: VERT_COLORS.agro },
  { origem: 'Usina Solar BA', destino: 'Energia do Brasil Ltda.', regra: 'Match setorial', classe: 'PROVÁVEL', cor: VERT_COLORS.logistica },
  { origem: 'Porto de Santos', destino: 'Transportadora Nacional S.A.', regra: 'Coincidência mun.', classe: 'POTENCIAL', cor: VERT_COLORS.engenharia },
];

/* ─── hook ───────────────────────────────────── */
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

/* ─── FitBounds control ──────────────────────── */
function FitBoundsControl({ mapRef, isMobile, isTablet }: {
  mapRef: React.MutableRefObject<L.Map | null>;
  isMobile: boolean;
  isTablet: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    const center = isMobile ? MOBILE_CENTER : (isTablet ? TABLET_CENTER : DESKTOP_CENTER);
    const zoom = isMobile ? 4 : 5;
    map.setView(center, zoom);
    (window as any).__mapCenter = center;
    (window as any).__mapZoom = zoom;
    map.on('zoomend', () => { (window as any).__mapZoom = map.getZoom(); });
  }, []);
  return null;
}

/* ─── divIcon factory ────────────────────────── */
function clusterIcon(color: string, count: number, selected: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div style="
      width:44px;height:44px;border-radius:50%;
      background:${color}${selected ? 'dd' : '33'};
      border:2px solid ${color};
      display:flex;align-items:center;justify-content:center;
      font-size:9px;font-weight:700;color:#fff;
      text-shadow:0 1px 3px rgba(0,0,0,0.9);
      cursor:pointer;transition:all 0.15s;
      pointer-events:none;
      transform:translateY(-2px);
    ">${fmt(count)}</div>`,
  });
}

/* ─── composite cluster donut icon ───────────── */
function compositeClusterIcon(segments: Array<{color: string, value: number}>, total: number, selected: boolean) {
  const sum = segments.reduce((a, s) => a + s.value, 0);
  let cumPct = 0;
  const stops = segments.map(s => {
    const pct = (s.value / sum) * 100;
    const start = cumPct;
    cumPct += pct;
    return `${s.color} ${start}% ${cumPct}%`;
  }).join(', ');
  const inner = 36;
  const outer = 56;
  return L.divIcon({
    className: '',
    iconSize: [outer, outer],
    iconAnchor: [outer / 2, outer / 2],
    html: `<div style="
      width:${outer}px;height:${outer}px;border-radius:50%;
      background:conic-gradient(${stops});
      border:${selected ? '2px solid #fff' : '2px solid rgba(255,255,255,0.3)'};
      box-shadow:0 0 12px rgba(0,0,0,0.6);
      display:flex;align-items:center;justify-content:center;
    ">
      <div style="
        width:${inner}px;height:${inner}px;border-radius:50%;
        background:#101C2D;
        display:flex;align-items:center;justify-content:center;
        font-size:8px;font-weight:700;color:#fff;
        text-shadow:0 1px 3px rgba(0,0,0,0.9);
        text-align:center;line-height:1.1;
        pointer-events:none;
      ">${fmt(total)}</div>
    </div>`,
  });
}

/* ─── KpiCard ────────────────────────────────── */
function KpiCard({ kpi, mobile }: { kpi: typeof kpis[0]; mobile?: boolean }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)', padding: mobile ? 10 : 16,
      display: 'flex', flexDirection: 'column', gap: mobile ? 2 : 4,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mobile ? 2 : 4 }}>
        <span style={{ fontSize: mobile ? 10 : 11, fontWeight: 500, color: 'var(--text-secondary)' }}>{kpi.label}</span>
        <div style={{ width: mobile ? 22 : 28, height: mobile ? 22 : 28, borderRadius: 6, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <kpi.icon size={mobile ? 11 : 14} color={kpi.color} />
        </div>
      </div>
      <span style={{ fontSize: mobile ? 16 : 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>{kpi.value}</span>
      <span style={{ fontSize: mobile ? 9 : 10, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{kpi.sub}</span>
    </div>
  );
}

/* ─── TerritoryBadge ─────────────────────────── */
function TerritoryBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
      </div>
    </div>
  );
}

/* ─── MAIN ───────────────────────────────────── */
export default function VisaoGeral() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1199px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState('');
  const [activeVert, setActiveVert] = useState('');
  const [activeUf, setActiveUf] = useState('');
  const [activeMun, setActiveMun] = useState('');
  const [activeType, setActiveType] = useState('');

  const filterCount = [activeVert, activeUf, activeMun, activeType].filter(Boolean).length;
  const mapRef = useRef<L.Map | null>(null);

  const kpiCols = isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
  const mainPad = isMobile ? 12 : 24;
  const mapHeight = isMobile ? 300 : (isTablet ? 400 : 450);

  const handleResetMap = () => {
    if (mapRef.current) {
      const center = isMobile ? MOBILE_CENTER : (isTablet ? TABLET_CENTER : DESKTOP_CENTER);
      const zoom = isMobile ? 4 : 5;
      mapRef.current.setView(center, zoom);
    }
  };

  const crossCols = isMobile ? '1fr' : (isTablet ? '1fr 1fr' : 'repeat(4, 1fr)');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
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
            <MobileSidebarContent onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      ) : (
        <DesktopSidebar />
      )}

      <div style={{
        marginLeft: isMobile ? 0 : 'var(--sidebar-w)',
        flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
        maxWidth: '100vw',
      }}>
        <header style={{
          height: 'var(--topbar-h)', background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center',
          padding: isMobile ? '0 12px' : '0 24px', gap: isMobile ? 8 : 16,
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
              <Menu size={20} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Visão Geral</h1>
            {!isMobile && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>Painel executivo multivertical</p>}
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
              <span>Jul 2026</span>
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
            <div style={{
              width: isMobile ? 26 : 28, height: isMobile ? 26 : 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-blue), #6C5CE7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff',
            }}>W</div>
          </div>
        </header>

        <main style={{
          flex: 1, padding: mainPad, overflowY: 'auto', overflowX: 'hidden',
          maxWidth: isMobile ? '100%' : 1680, width: '100%', margin: '0 auto',
        }}>
          {/* ── 1. KPI Grid ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: kpiCols,
            gap: isMobile ? 8 : 12, marginBottom: 16,
          }}>
            {kpis.map(k => <KpiCard key={k.label} kpi={k} mobile={isMobile} />)}
          </div>

          {/* ── 2. Map + Territory Panel ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : (isTablet ? '1fr' : '1fr 340px'),
            gap: 14, marginBottom: 16,
          }}>
            <section style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>
              <FilterBar
                mobile={isMobile}
                filterOpen={filterOpen}
                setFilterOpen={setFilterOpen}
                activeVert={activeVert} setActiveVert={setActiveVert}
                activeUf={activeUf} setActiveUf={setActiveUf}
                activeMun={activeMun} setActiveMun={setActiveMun}
                activeType={activeType} setActiveType={setActiveType}
                filterCount={filterCount}
                onResetMap={handleResetMap}
              />
              {isMobile && filterOpen && (
                <FilterDrawer
                  activeVert={activeVert} setActiveVert={setActiveVert}
                  activeUf={activeUf} setActiveUf={setActiveUf}
                  activeMun={activeMun} setActiveMun={setActiveMun}
                  activeType={activeType} setActiveType={setActiveType}
                  onClose={() => setFilterOpen(false)}
                />
              )}
              <div style={{ height: mapHeight, position: 'relative' }}>
                <MapContainer
                  center={DESKTOP_CENTER} zoom={5}
                  scrollWheelZoom={true}
                  style={{ height: '100%', width: '100%', background: '#08111F' }}
                  zoomControl={false}
                  maxBounds={BRAZIL_BOUNDS}
                  maxBoundsViscosity={1}
                  worldCopyJump={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                  <FitBoundsControl mapRef={mapRef} isMobile={isMobile} isTablet={isTablet} />
                  {clusterData.map(c => {
                    const isSelected = selectedCluster === c.uf;
                    if (c.uf === 'Sudeste') {
                      const engVal = 152340, agroVal = 98340, logVal = 74120;
                      const seTotal = engVal + agroVal + logVal;
                      const seSegments = [
                        { color: VERT_COLORS.engenharia, value: engVal },
                        { color: VERT_COLORS.agro, value: agroVal },
                        { color: VERT_COLORS.logistica, value: logVal },
                      ];
                      const engPct = ((engVal / seTotal) * 100).toFixed(1);
                      const agroPct = ((agroVal / seTotal) * 100).toFixed(1);
                      const logPct = ((logVal / seTotal) * 100).toFixed(1);
                      return (
                        <React.Fragment key={c.uf}>
                          <Marker
                            position={[c.lat, c.lng]}
                            icon={compositeClusterIcon(seSegments, seTotal, isSelected)}
                            eventHandlers={{
                              click: () => {
                                setSelectedCluster(c.uf === selectedCluster ? '' : c.uf);
                                if (mapRef.current) mapRef.current.setView([c.lat, c.lng], 7, { animate: true });
                              },
                            }}
                          >
                            <Tooltip direction="top" offset={[0, -14]} className="map-tooltip">
                              <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                                <strong>Sudeste</strong><br />
                                <span style={{ fontSize: 9, color: '#999' }}>SP + MG + RJ agregados</span>
                                <div style={{ borderTop: '1px solid #333', margin: '4px 0' }} />
                                Engenharia: {fmt(engVal)} ({engPct}%)<br />
                                Agro: {fmt(agroVal)} ({agroPct}%)<br />
                                Logística: {fmt(logVal)} ({logPct}%)
                                <div style={{ borderTop: '1px solid #555', margin: '4px 0' }} />
                                <strong>Total: {fmt(seTotal)}</strong>
                              </div>
                            </Tooltip>
                          </Marker>
                        </React.Fragment>
                      );
                    }
                    const color = VERT_COLORS[c.vertical];
                    return (
                      <React.Fragment key={c.uf}>
                        <CircleMarker
                          center={[c.lat, c.lng]}
                          radius={isMobile ? 14 : 18}
                          pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: isSelected ? 0.5 : 0.2,
                            weight: isSelected ? 3 : 2,
                          }}
                          eventHandlers={{
                            click: () => {
                              setSelectedCluster(c.uf === selectedCluster ? '' : c.uf);
                              if (mapRef.current) mapRef.current.setView([c.lat, c.lng], 6, { animate: true });
                            },
                            mouseover: (e) => { e.target.setStyle({ fillOpacity: 0.5, weight: 3 }); },
                            mouseout: (e) => { if (!isSelected) { e.target.setStyle({ fillOpacity: 0.2, weight: 2 }); }},
                          }}
                        >
                          <Tooltip direction="top" offset={[0, -10]} className="map-tooltip">
                            <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                              <strong>{c.uf}</strong> — {VERT_LABELS[c.vertical]}<br />
                              Obras: {fmt(c.obras)} · Empresas: {fmt(c.empresas)}<br />
                              Oportunidades: {c.oportunidades.toLocaleString()}
                            </div>
                          </Tooltip>
                        </CircleMarker>
                        <Marker
                          position={[c.lat, c.lng]}
                          icon={clusterIcon(color, c.oportunidades, isSelected)}
                          interactive={false}
                          keyboard={false}
                        />
                      </React.Fragment>
                    );
                  })}
                </MapContainer>
                {!isMobile && (
                  <div style={{
                    position: 'absolute', bottom: 10, left: 10, zIndex: 1000,
                    background: 'rgba(8,17,31,0.92)', padding: '5px 8px',
                    borderRadius: 6, fontSize: 10, color: 'var(--text-tertiary)',
                    display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '80%',
                  }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {Object.entries(VERT_COLORS).map(([key, color]) => (
                        <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                          {VERT_LABELS[key] || key}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-disabled)', fontStyle: 'italic' }}>
                      Dados ilustrativos para validação visual do mapa.
                    </div>
                  </div>
                )}
              </div>
            </section>

            {!isMobile && (
              <TerritoryPanel />
            )}
          </div>

          {isMobile && (
            <TerritoryPanel />
          )}

          {/* ── 3. Bottom row ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : (isTablet ? '1fr 1fr' : '1fr 1fr 1fr'),
            gap: 14, marginBottom: 16,
          }}>
            <FeaturedEventCard />
            <QualityConnectionsCard />
            <QuickActionsCard />
          </div>

          {/* ── 4. Cross-relationships ── */}
          <CrossRelationsCard cols={crossCols} />

          {/* ── 5. Footer ── */}
          <footer style={{
            padding: '12px 0', borderTop: '1px solid var(--border-subtle)',
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
            fontSize: 10, color: 'var(--text-disabled)', gap: isMobile ? 4 : 0,
          }}>
            <span>Fontes: DNIT-SICRO, CNES, RNTRC, CAR, Receita Federal · Dados atualizados em Jul/2026</span>
            <span>WiNS Hub — Inteligência Multivertical · v2.0.0-mockup</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

/* ─── FilterBar ──────────────────────────────── */
function FilterBar({ mobile, filterOpen, setFilterOpen, activeVert, setActiveVert, activeUf, setActiveUf, activeMun, setActiveMun, activeType, setActiveType, filterCount, onResetMap }: {
  mobile: boolean; filterOpen: boolean; setFilterOpen: (v: boolean) => void;
  activeVert: string; setActiveVert: (v: string) => void;
  activeUf: string; setActiveUf: (v: string) => void;
  activeMun: string; setActiveMun: (v: string) => void;
  activeType: string; setActiveType: (v: string) => void;
  filterCount: number; onResetMap: () => void;
}) {
  const clearFilters = () => { setActiveVert(''); setActiveUf(''); setActiveMun(''); setActiveType(''); };
  const hasFilters = filterCount > 0;

  if (mobile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Recorte territorial</span>
        <button onClick={() => setFilterOpen(!filterOpen)} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
          background: hasFilters ? 'var(--accent-blue-bg)' : 'var(--bg-base)',
          border: '1px solid var(--border-subtle)', borderRadius: 4, cursor: 'pointer',
          fontSize: 11, color: hasFilters ? 'var(--accent-blue)' : 'var(--text-secondary)',
        }}>
          <SlidersHorizontal size={12} />
          Filtros{hasFilters ? ` (${filterCount})` : ''}
        </button>
        {hasFilters && <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}><X size={14} /></button>}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)',
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginRight: 4 }}>Recorte territorial integrado</span>
      <div style={{ flex: 1, minWidth: 8 }} />
      <select value={activeVert} onChange={e => setActiveVert(e.target.value)}
        style={{ fontSize: 10, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', maxWidth: 120 }}>
        <option value="">Vertical: Todas</option>
        <option value="engenharia">Engenharia</option><option value="agro">Agro</option>
        <option value="logistica">Logística</option><option value="saude">Saúde</option>
      </select>
      <select value={activeUf} onChange={e => setActiveUf(e.target.value)}
        style={{ fontSize: 10, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', maxWidth: 90 }}>
        <option value="">UF: Todas</option>
        {['SP','MG','RJ','BA','RS','PR','SC','PE','CE','PA'].map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <select value={activeMun} onChange={e => setActiveMun(e.target.value)}
        style={{ fontSize: 10, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', maxWidth: 130 }}>
        <option value="">Município: Todos</option>
        <option value="sp">São Paulo</option><option value="rj">Rio de Janeiro</option>
        <option value="bh">Belo Horizonte</option><option value="poa">Porto Alegre</option>
        <option value="salvador">Salvador</option>
      </select>
      <select value={activeType} onChange={e => setActiveType(e.target.value)}
        style={{ fontSize: 10, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', maxWidth: 120 }}>
        <option value="">Tipo: Todos</option>
        <option value="obra">Obra</option><option value="empresa">Empresa</option>
        <option value="oportunidade">Oportunidade</option>
      </select>
      {hasFilters && (
        <button onClick={clearFilters} style={{
          padding: '3px 6px', fontSize: 10, background: 'transparent',
          border: '1px solid var(--border-subtle)', borderRadius: 4,
          color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
        }}>
          <XCircle size={10} /> Limpar
        </button>
      )}
      <button onClick={onResetMap} style={{
        padding: '3px 6px', fontSize: 10,
        background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)',
        borderRadius: 4, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 3,
      }}>
        <RotateCcw size={10} /> Redefinir mapa
      </button>
      {hasFilters && <span style={{ fontSize: 9, color: 'var(--accent-blue)', fontWeight: 600 }}>{filterCount} ativo(s)</span>}
    </div>
  );
}

/* ─── FilterDrawer (mobile) ──────────────────── */
function FilterDrawer({ activeVert, setActiveVert, activeUf, setActiveUf, activeMun, setActiveMun, activeType, setActiveType, onClose }: {
  activeVert: string; setActiveVert: (v: string) => void;
  activeUf: string; setActiveUf: (v: string) => void;
  activeMun: string; setActiveMun: (v: string) => void;
  activeType: string; setActiveType: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Filtros</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={16} /></button>
      </div>
      <select value={activeVert} onChange={e => setActiveVert(e.target.value)} style={{ fontSize: 11, padding: '6px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', width: '100%' }}>
        <option value="">Vertical: Todas</option>
        <option value="engenharia">Engenharia</option><option value="agro">Agro</option><option value="logistica">Logística</option><option value="saude">Saúde</option>
      </select>
      <select value={activeUf} onChange={e => setActiveUf(e.target.value)} style={{ fontSize: 11, padding: '6px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', width: '100%' }}>
        <option value="">UF: Todas</option>
        {['SP','MG','RJ','BA','RS','PR','SC','PE','CE','PA'].map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <select value={activeMun} onChange={e => setActiveMun(e.target.value)} style={{ fontSize: 11, padding: '6px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', width: '100%' }}>
        <option value="">Município: Todos</option>
        <option value="sp">São Paulo</option><option value="rj">Rio de Janeiro</option><option value="bh">Belo Horizonte</option><option value="poa">Porto Alegre</option><option value="salvador">Salvador</option>
      </select>
      <select value={activeType} onChange={e => setActiveType(e.target.value)} style={{ fontSize: 11, padding: '6px 8px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', width: '100%' }}>
        <option value="">Tipo: Todos</option>
        <option value="obra">Obra</option><option value="empresa">Empresa</option><option value="oportunidade">Oportunidade</option>
      </select>
      <button onClick={() => { setActiveVert(''); setActiveUf(''); setActiveMun(''); setActiveType(''); }} style={{ padding: '6px', fontSize: 11, background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-tertiary)', cursor: 'pointer' }}>Limpar todos</button>
    </div>
  );
}

/* ─── TerritoryPanel ─────────────────────────── */
function TerritoryPanel() {
  return (
    <aside style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)', padding: 14,
      display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12,
    }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
        Resumo territorial
      </h3>
      <TerritoryBadge label="Municípios no recorte" value="827 / 5.570" color={VERT_COLORS.engenharia} />
      <TerritoryBadge label="Obras (Sudeste, BA, RS)" value="16.633" color={VERT_COLORS.engenharia} />
      <TerritoryBadge label="Empresas ativas" value="636.404" color={VERT_COLORS.oportunidades} />
      <TerritoryBadge label="Oportunidades (score ≥70)" value="641.968" color={VERT_COLORS.logistica} />
      <TerritoryBadge label="Transportadores RNTRC" value="241.920" color={VERT_COLORS.logistica} />
      <TerritoryBadge label="Estabelecimentos CNES" value="387.410" color={VERT_COLORS.saude} />
      <TerritoryBadge label="Imóveis CAR" value="852.190" color={VERT_COLORS.agro} />
      <TerritoryBadge label="Relações documentais" value="133.697" color={VERT_COLORS.agro} />
      <TerritoryBadge label="Relações potenciais" value="610" color={VERT_COLORS.engenharia} />
    </aside>
  );
}

/* ─── FeaturedEventCard ──────────────────────── */
function FeaturedEventCard() {
  return (
    <section style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)', padding: 14,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-blue)', background: 'var(--accent-blue-bg)', padding: '2px 8px', borderRadius: 10 }}>
          Evento relevante
        </span>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: 2 }}>
        Dados ilustrativos para validação do layout
      </div>
      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{featuredEvent.title}</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>
        <span>Município</span><span style={{ color: 'var(--text-primary)' }}>{featuredEvent.municipio}</span>
        <span>Fase</span><span style={{ color: 'var(--text-primary)' }}>{featuredEvent.fase}</span>
        <span>CAPEX</span><span style={{ color: VERT_COLORS.logistica, fontWeight: 600 }}>{featuredEvent.capex}</span>
        <span>Fonte</span><span style={{ color: 'var(--text-tertiary)' }}>{featuredEvent.fonte}</span>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-disabled)', marginTop: 2, lineHeight: 1.3 }}>
        Os valores apresentados são ilustrativos e não refletem dados oficiais ou contratos vigentes.
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button style={{ padding: '5px 10px', fontSize: 10, background: 'var(--accent-blue)', color: '#fff', borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
          Ver detalhe <ChevronRight size={10} />
        </button>
        <button style={{ padding: '5px 10px', fontSize: 10, border: '1px solid var(--border-default)', color: 'var(--text-secondary)', borderRadius: 6, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Building2 size={10} /> Empresa 360°
        </button>
      </div>
    </section>
  );
}

/* ─── QualityConnectionsCard ─────────────────── */
function QualityConnectionsCard() {
  return (
    <section style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)', padding: 14,
      display: 'flex', flexDirection: 'column',
    }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
        Qualidade dos vínculos
      </h3>
      <p style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 4 }}>
        1.314.135 matches físicos · {connections.reduce((a, c) => a + parseInt(c.value.replace(/\D/g, '')), 0).toLocaleString()} no recorte
      </p>
      {connections.map(c => (
        <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: c.color }}>{c.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{c.value}</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>{c.desc}</div>
          </div>
        </div>
      ))}
      <div style={{ fontSize: 9, color: 'var(--text-disabled)', marginTop: 6, lineHeight: 1.4 }}>
        Coincidência municipal não representa vínculo contratual, operacional ou comercial.
      </div>
    </section>
  );
}

/* ─── QuickActionsCard ───────────────────────── */
function QuickActionsCard() {
  return (
    <section style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)', padding: 14,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
        Atalhos operacionais
      </h3>
      {quickActions.map(a => (
        <a key={a.label} href={a.route} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
          background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)',
          textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 11,
          transition: 'all var(--transition-fast)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-base)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
          <a.icon size={14} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ flex: 1 }}>{a.label}</span>
          <ArrowUpRight size={12} style={{ color: 'var(--text-disabled)' }} />
        </a>
      ))}
    </section>
  );
}

/* ─── CrossRelationsCard ─────────────────────── */
function CrossRelationsCard({ cols }: { cols: string }) {
  return (
    <section style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Relações transversais</h3>
        <a href="#" style={{ fontSize: 10, color: 'var(--accent-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
          Ver todas <ChevronRight size={10} />
        </a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8 }}>
        {crossRelations.map(r => (
          <div key={`${r.origem}-${r.destino}`} style={{
            background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)',
            padding: 10, border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 3 }}>ORIGEM</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>{r.origem}</div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 3 }}>DESTINO</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>{r.destino}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{r.regra}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: r.cor }}>{r.classe}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── DesktopSidebar ─────────────────────────── */
function DesktopSidebar() {
  const navItems = [
    { icon: LayoutDashboard, label: 'Visão Geral', route: '/mockups-v2/visao-geral', active: true },
    { icon: HardHat, label: 'Engenharia', route: '#', active: false },
    { icon: Tractor, label: 'Agro', route: '#', active: false },
    { icon: Truck, label: 'Logística', route: '#', active: false },
    { icon: Stethoscope, label: 'Saúde', route: '#', active: false },
    { icon: Share2, label: 'Relacionamentos', route: '#', active: false },
    { icon: Building2, label: 'Empresa 360°', route: '#', active: false },
    { icon: MP, label: 'Inteligência Territorial', route: '#', active: false },
    { icon: Search, label: 'Busca Global', route: '#', active: false },
  ];

  return (
    <aside style={{
      width: 'var(--sidebar-w)', height: '100vh', background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-default)',
      display: 'flex', flexDirection: 'column', position: 'fixed',
      left: 0, top: 0, zIndex: 100, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px',
        borderBottom: '1px solid var(--border-default)', minHeight: 64,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <ShieldCheck size={14} /><span>Homologação</span>
        </div>
        <div style={{ marginBottom: 2 }}>William · Analista</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <LogOut size={14} /><span>Sair</span>
        </div>
      </div>
    </aside>
  );
}

/* ─── MobileSidebarContent ────────────────────── */
function MobileSidebarContent({ onClose }: { onClose: () => void }) {
  const navItems = [
    { icon: LayoutDashboard, label: 'Visão Geral', route: '/mockups-v2/visao-geral', active: true },
    { icon: HardHat, label: 'Engenharia', route: '#', active: false },
    { icon: Tractor, label: 'Agro', route: '#', active: false },
    { icon: Truck, label: 'Logística', route: '#', active: false },
    { icon: Stethoscope, label: 'Saúde', route: '#', active: false },
    { icon: Share2, label: 'Relacionamentos', route: '#', active: false },
    { icon: Building2, label: 'Empresa 360°', route: '#', active: false },
    { icon: MP, label: 'Inteligência Territorial', route: '#', active: false },
    { icon: Search, label: 'Busca Global', route: '#', active: false },
  ];

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: '1px solid var(--border-default)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, var(--accent-blue), #6C5CE7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: '#fff',
          }}>W</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>WiNS Hub</div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Inteligência Multivertical</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}>
          <X size={18} />
        </button>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <ShieldCheck size={14} /><span>Homologação</span>
        </div>
        <div style={{ marginBottom: 2 }}>William · Analista</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <LogOut size={14} /><span>Sair</span>
        </div>
      </div>
    </>
  );
}
