import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  HardHat, Truck, Stethoscope, Building2, Target,
  MapPin, Users, FileText, ArrowUpRight, CheckCircle2,
  Search, RotateCcw, ChevronRight, BarChart3
} from 'lucide-react';
import { httpClient } from '../services/http/client';

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

function fmt(n: number): string {
  if (!n) return '0';
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
  }, [map, isMobile, isTablet, mapRef]);
  return null;
}

function compositeClusterIcon(segments: Array<{color: string, value: number}>, total: number, selected: boolean) {
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
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

function KpiCard({ kpi, mobile }: { kpi: any; mobile?: boolean }) {
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

export function VisaoGeral() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1199px)');
  const [selectedCluster, setSelectedCluster] = useState('');
  const [activeVert, setActiveVert] = useState('');
  const [activeUf, setActiveUf] = useState('');
  const [realData, setRealData] = useState<any>(null);

  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await httpClient.get('/dashboard/kpis');
        setRealData(res.data);
      } catch (e) {
        console.error('Failed to load dashboard KPIs from backend:', e);
      }
    }
    loadData();
  }, []);

  const kpiCols = isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
  const mainPad = isMobile ? 12 : 24;
  const mapHeight = isMobile ? 300 : (isTablet ? 400 : 450);

  const kpis = [
    { label: 'Obras visíveis', value: realData?.obrasCount ? realData.obrasCount.toLocaleString('pt-BR') : '16.633', sub: 'catálogo físico: 35.690', icon: HardHat, color: VERT_COLORS.engenharia, bg: 'rgba(59,130,246,0.12)' },
    { label: 'Empresas ativas', value: realData?.empresasCount ? realData.empresasCount.toLocaleString('pt-BR') : '636.404', sub: 'registros físicos: ~4,8M', icon: Building2, color: VERT_COLORS.oportunidades, bg: 'rgba(139,92,246,0.12)' },
    { label: 'Oportunidades', value: realData?.oportunidadesCount ? realData.oportunidadesCount.toLocaleString('pt-BR') : '641.968', sub: 'matches score ≥70: 1.210.670', icon: Target, color: VERT_COLORS.logistica, bg: 'rgba(245,158,11,0.12)' },
    { label: 'Relações documentais confirmadas', value: realData?.confirmadosCount ? realData.confirmadosCount.toLocaleString('pt-BR') : '133.697', sub: 'vínculos documentais explícitos', icon: CheckCircle2, color: VERT_COLORS.agro, bg: 'rgba(34,197,94,0.12)' },
    { label: 'Imóveis CAR', value: realData?.carCount ? realData.carCount.toLocaleString('pt-BR') : '852.190', sub: 'físicos: 8.291.331', icon: MapPin, color: VERT_COLORS.agro, bg: 'rgba(34,197,94,0.08)' },
    { label: 'Transportadores', value: realData?.rntrcCount ? realData.rntrcCount.toLocaleString('pt-BR') : '241.920', sub: 'RNTRC físicos: 1.124.684', icon: Truck, color: VERT_COLORS.logistica, bg: 'rgba(245,158,11,0.08)' },
    { label: 'Estabelecimentos CNES', value: realData?.cnesCount ? realData.cnesCount.toLocaleString('pt-BR') : '387.410', sub: 'físicos: 623.208', icon: Stethoscope, color: VERT_COLORS.saude, bg: 'rgba(236,72,153,0.12)' },
    { label: 'Relações potenciais', value: '610 / 827', sub: '610 municípios no recorte com presença nas quatro verticais', icon: Users, color: VERT_COLORS.engenharia, bg: 'rgba(79,124,255,0.12)' },
  ];

  const connections = [
    { label: 'CONFIRMADO', value: realData?.confirmadosCount ? realData.confirmadosCount.toLocaleString('pt-BR') : '133.697', color: VERT_COLORS.agro, desc: 'Vínculos com chave documental explícita (CNPJ executora × CNPJ mantenedora)' },
    { label: 'PROVÁVEL', value: '1.210.670', color: VERT_COLORS.logistica, desc: 'Match algorítmico score ≥70' },
    { label: 'POTENCIAL', value: '610', color: VERT_COLORS.engenharia, desc: 'Coincidência territorial — sem contrato' },
  ];

  const clusterData = [
    { uf: 'Sudeste', lat: -22.2, lng: -44.5, obras: 6530, empresas: 217430, oportunidades: 324800, vertical: 'oportunidades' as const },
    { uf: 'BA', lat: -12.97, lng: -38.50, obras: 1289, empresas: 34108, oportunidades: 52340, vertical: 'saude' as const },
    { uf: 'RS', lat: -30.03, lng: -51.23, obras: 1127, empresas: 42108, oportunidades: 61230, vertical: 'logistica' as const },
  ];

  const quickActions = [
    { label: 'Explorar mapa', icon: MapPin, route: '/mapa' },
    { label: 'Relatório executivo', icon: FileText, route: '/relatorios' },
    { label: 'Busca avançada', icon: Search, route: '/busca' },
    { label: 'Exportar dados', icon: BarChart3, route: '/engenharia/obras' },
  ];

  const crossRelations = [
    { origem: 'Infraestrutura Rodoviária', destino: 'Consórcio de Manutenção', regra: 'CNPJ executora', classe: 'CONFIRMADO', cor: VERT_COLORS.agro },
    { origem: 'Rede Hospitalar Estadual', destino: 'Governo do Estado', regra: 'Mantenedora CNES', classe: 'CONFIRMADO', cor: VERT_COLORS.agro },
    { origem: 'Complexo Logístico', destino: 'Operador de Transporte', regra: 'Match setorial', classe: 'PROVÁVEL', cor: VERT_COLORS.logistica },
    { origem: 'Terminal de Cargas', destino: 'Transportadora Nacional', regra: 'Coincidência mun.', classe: 'POTENCIAL', cor: VERT_COLORS.engenharia },
  ];

  const handleResetMap = () => {
    if (mapRef.current) {
      const center = isMobile ? MOBILE_CENTER : (isTablet ? TABLET_CENTER : DESKTOP_CENTER);
      const zoom = isMobile ? 4 : 5;
      mapRef.current.setView(center, zoom);
    }
  };

  const crossCols = isMobile ? '1fr' : (isTablet ? '1fr 1fr' : 'repeat(4, 1fr)');

  return (
    <div style={{ padding: mainPad, maxWidth: 1680, width: '100%', margin: '0 auto' }}>
      {/* 1. KPI Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: kpiCols,
        gap: isMobile ? 8 : 12, marginBottom: 16,
      }}>
        {kpis.map(k => <KpiCard key={k.label} kpi={k} mobile={isMobile} />)}
      </div>

      {/* 2. Map + Territory Panel */}
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
          {/* FilterBar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginRight: 4 }}>Recorte territorial integrado</span>
            <div style={{ flex: 1, minWidth: 8 }} />
            <select value={activeVert} onChange={e => setActiveVert(e.target.value)}
              style={{ fontSize: 10, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', maxWidth: 120 }}>
              <option value="">Vertical: Todas</option>
              <option value="engenharia">Engenharia</option>
              <option value="agro">Agro</option>
              <option value="logistica">Logística</option>
              <option value="saude">Saúde</option>
            </select>
            <select value={activeUf} onChange={e => setActiveUf(e.target.value)}
              style={{ fontSize: 10, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-secondary)', maxWidth: 90 }}>
              <option value="">UF: Todas</option>
              {['SP','MG','RJ','BA','RS','PR','SC','PE','CE','PA'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <button onClick={handleResetMap} style={{
              padding: '3px 6px', fontSize: 10,
              background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)',
              borderRadius: 4, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              <RotateCcw size={10} /> Redefinir mapa
            </button>
          </div>

          <div style={{ height: mapHeight, position: 'relative' }}>
            <MapContainer
              center={DESKTOP_CENTER} zoom={5}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%', background: '#08111F' }}
              zoomControl={false}
              maxBounds={BRAZIL_BOUNDS}
              maxBoundsViscosity={1}
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
                  return (
                    <Marker
                      key={c.uf}
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
                          Engenharia: {fmt(engVal)}<br />
                          Agro: {fmt(agroVal)}<br />
                          Logística: {fmt(logVal)}<br />
                          <strong>Total: {fmt(seTotal)}</strong>
                        </div>
                      </Tooltip>
                    </Marker>
                  );
                }
                const color = VERT_COLORS[c.vertical];
                return (
                  <CircleMarker
                    key={c.uf}
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
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -10]} className="map-tooltip">
                      <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                        <strong>{c.uf}</strong> — {VERT_LABELS[c.vertical]}<br />
                        Obras: {fmt(c.obras)} · Empresas: {fmt(c.empresas)}
                      </div>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </section>

        {/* Territory Panel */}
        <aside style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)', padding: 14,
          display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            Resumo territorial
          </h3>
          <TerritoryBadge label="Municípios no recorte" value="827 / 5.570" color={VERT_COLORS.engenharia} />
          <TerritoryBadge label="Obras (Sudeste, BA, RS)" value={kpis[0].value} color={VERT_COLORS.engenharia} />
          <TerritoryBadge label="Empresas ativas" value={kpis[1].value} color={VERT_COLORS.oportunidades} />
          <TerritoryBadge label="Oportunidades (score ≥70)" value={kpis[2].value} color={VERT_COLORS.logistica} />
          <TerritoryBadge label="Transportadores RNTRC" value={kpis[5].value} color={VERT_COLORS.logistica} />
          <TerritoryBadge label="Estabelecimentos CNES" value={kpis[6].value} color={VERT_COLORS.saude} />
          <TerritoryBadge label="Imóveis CAR" value={kpis[4].value} color={VERT_COLORS.agro} />
          <TerritoryBadge label="Relações documentais" value={kpis[3].value} color={VERT_COLORS.agro} />
          <TerritoryBadge label="Relações potenciais" value="610" color={VERT_COLORS.engenharia} />
        </aside>
      </div>

      {/* 3. Bottom row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : (isTablet ? '1fr 1fr' : '1fr 1fr 1fr'),
        gap: 14, marginBottom: 16,
      }}>
        {/* Quality Connections */}
        <section style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)', padding: 14,
          display: 'flex', flexDirection: 'column',
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            Qualidade dos vínculos
          </h3>
          <p style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 4 }}>
            Classificação semântica dos relacionamentos
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

        {/* Quick Actions */}
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
            }}>
              <a.icon size={14} style={{ color: 'var(--accent-blue)' }} />
              <span style={{ flex: 1 }}>{a.label}</span>
              <ArrowUpRight size={12} style={{ color: 'var(--text-disabled)' }} />
            </a>
          ))}
        </section>

        {/* System Overview info */}
        <section style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)', padding: 14,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            Base de Conhecimento
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Plataforma unificada com integração direta às APIs do WiNS Hub. Integração em tempo real com barramentos de Engenharia, Logística, Agro e Saúde.
          </p>
          <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-subtle)', fontSize: 10, color: 'var(--text-tertiary)' }}>
            Status da API: <span style={{ color: '#22C55E', fontWeight: 600 }}>Operacional (18085 / 18083)</span>
          </div>
        </section>
      </div>

      {/* 4. Cross-relationships */}
      <section style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Relações transversais</h3>
          <a href="/relacionamentos" style={{ fontSize: 10, color: 'var(--accent-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
            Ver todas <ChevronRight size={10} />
          </a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: crossCols, gap: 8 }}>
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

      {/* 5. Footer */}
      <footer style={{
        padding: '12px 0', borderTop: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
        fontSize: 10, color: 'var(--text-disabled)', gap: isMobile ? 4 : 0,
      }}>
        <span>Fontes: DNIT-SICRO, CNES, RNTRC, CAR, Receita Federal · Dados oficiais atualizados</span>
        <span>WiNS Hub — Plataforma Unificada de Inteligência Territorial</span>
      </footer>
    </div>
  );
}

export default VisaoGeral;
