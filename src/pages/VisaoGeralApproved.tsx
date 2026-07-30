import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  HardHat, Tractor, Truck, Stethoscope, Building2, Target,
  MapPin, Users, CheckCircle2, Search, RotateCcw, Menu,
  ShieldCheck, SlidersHorizontal, ArrowUpRight, Sparkles,
  TrendingUp, AlertTriangle, Layers, Info, Filter, ArrowRight, Download, RefreshCw
} from 'lucide-react';
import { hubService } from '../services/hub';
import type { HubDataset, OverviewEntity } from '../types/hub';
import { ALL_27_UFS } from '../services/canonicalTerritorialService';
import { useAuth } from '../services/auth';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { exportService } from '../services/exportService';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  return matches;
}

const BRAZIL_CENTER: [number, number] = [-14.235, -51.925];
const BRAZIL_ZOOM_DESKTOP = 4.5;
const BRAZIL_ZOOM_MOBILE = 3.8;

const VERT_COLORS = {
  engenharia: '#3B82F6',
  agro: '#22C55E',
  logistica: '#F59E0B',
  saude: '#EC4899',
  oportunidades: '#8B5CF6',
} as const;

function fmt(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace('.', ',') + ' mil';
  return new Intl.NumberFormat('pt-BR').format(n);
}

function FitBoundsControl({ mapRef, isMobile }: {
  mapRef: React.MutableRefObject<L.Map | null>;
  isMobile: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    const zoom = isMobile ? BRAZIL_ZOOM_MOBILE : BRAZIL_ZOOM_DESKTOP;
    map.setView(BRAZIL_CENTER, zoom);
  }, [map, mapRef, isMobile]);
  return null;
}

export default function VisaoGeralApproved() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1199px)');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [hubData, setHubData] = useState<HubDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const scopeFromUrl = (searchParams.get('scope') || 'BR') as 'BR' | 'UF';
  const ufFromUrl = searchParams.get('uf') || '';

  const [selectedUf, setSelectedUf] = useState(ufFromUrl);
  const [activeVert, setActiveVert] = useState('');
  const [activeMun, setActiveMun] = useState('');
  const [activeType, setActiveType] = useState('');

  const [selectedEntity, setSelectedEntity] = useState<OverviewEntity | null>(null);
  const [layers, setLayers] = useState({
    engenharia: true, agro: true, logistica: true, saude: true, oportunidades: true,
  });

  const mapRef = useRef<L.Map | null>(null);

  const currentScope: 'BR' | 'UF' = selectedUf ? 'UF' : 'BR';
  const selectedUfInfo = currentScope === 'UF' ? ALL_27_UFS.find(u => u.sigla === selectedUf) : null;

  const updateUrlParams = useCallback((params: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(params).forEach(([k, v]) => {
      if (v) next.set(k, v);
      else next.delete(k);
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadingMessage(selectedUf && selectedUfInfo ? `Carregando recorte de ${selectedUfInfo.nome}…` : 'Carregando recorte nacional…');
    setError(null);
    hubService.load({ scope: currentScope, uf: selectedUf || undefined })
      .then(data => {
        if (active) {
          setHubData(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          setError(err?.message || 'Falha ao carregar inteligência multivertical');
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [selectedUf]);

  useEffect(() => {
    updateUrlParams({ scope: selectedUf ? 'UF' : undefined, uf: selectedUf || undefined });
  }, [selectedUf]);

  const handleUfChange = (val: string) => {
    setSelectedUf(val);
    setActiveVert('');
    setActiveMun('');
    setActiveType('');
    setSelectedEntity(null);
    if (mapRef.current) {
      const zoom = isMobile ? BRAZIL_ZOOM_MOBILE : BRAZIL_ZOOM_DESKTOP;
      if (!val) {
        mapRef.current.setView(BRAZIL_CENTER, zoom);
      }
    }
  };

  const allEntities = hubData?.overview?.entities || [];
  const counts = hubData?.overview?.counts || {
    works: 0, companies: 0, opportunities: 0, confirmedRelations: 0,
    ruralProperties: 0, carriers: 0, healthEstablishments: 0, potentialRelations: 0,
  };

  const kpis = [
    { label: 'Obras visíveis', value: fmt(counts.works), sub: 'Catálogo oficial de Engenharia', icon: HardHat, color: VERT_COLORS.engenharia, bg: 'rgba(59,130,246,0.12)', route: '/engenharia/obras' },
    { label: 'Empresas 360°', value: fmt(counts.companies), sub: 'Cadastros corporativos', icon: Building2, color: VERT_COLORS.oportunidades, bg: 'rgba(139,92,246,0.12)', route: '/empresas' },
    { label: 'Oportunidades IA', value: fmt(counts.opportunities), sub: 'Matches de propensão comercial', icon: Target, color: VERT_COLORS.logistica, bg: 'rgba(245,158,11,0.12)', route: '/oportunidades' },
    { label: 'Relações confirmadas', value: fmt(counts.confirmedRelations), sub: 'Chaves documentais exatas', icon: CheckCircle2, color: VERT_COLORS.agro, bg: 'rgba(34,197,94,0.12)', route: '/relacionamentos' },
    { label: 'Imóveis Agro CAR', value: fmt(counts.ruralProperties), sub: 'Cadastro Ambiental Rural', icon: MapPin, color: VERT_COLORS.agro, bg: 'rgba(34,197,94,0.08)', route: '/agro' },
    { label: 'Transportadores RNTRC', value: fmt(counts.carriers), sub: 'Frotas e operadoras ANTT', icon: Truck, color: VERT_COLORS.logistica, bg: 'rgba(245,158,11,0.08)', route: '/logistica' },
    { label: 'Estabelecimentos CNES', value: fmt(counts.healthEstablishments), sub: 'Unidades de Saúde e SUS', icon: Stethoscope, color: VERT_COLORS.saude, bg: 'rgba(236,72,153,0.12)', route: '/saude' },
    { label: 'Municípios com relações', value: `${fmt(counts.potentialRelations)} mun.`, sub: 'Cobertura territorial 100%', icon: Users, color: VERT_COLORS.engenharia, bg: 'rgba(79,124,255,0.12)', route: '/territorial' },
  ];

  const handleResetMap = () => {
    setActiveVert('');
    setActiveMun('');
    setActiveType('');
    setSearchQuery('');
    if (mapRef.current) {
      const zoom = isMobile ? BRAZIL_ZOOM_MOBILE : BRAZIL_ZOOM_DESKTOP;
      mapRef.current.setView(BRAZIL_CENTER, zoom);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/busca?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const filteredEntities = allEntities.filter(e => {
    if (!layers[e.vertical as keyof typeof layers]) return false;
    if (activeVert && e.vertical !== activeVert) return false;
    if (selectedUf && e.uf !== selectedUf) return false;
    if (activeMun && e.municipality !== activeMun) return false;
    if (activeType && e.kind !== activeType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!e.name.toLowerCase().includes(q) && !e.municipality.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filterCount = [activeVert, selectedUf, activeMun, activeType, searchQuery].filter(Boolean).length;

  const scopeBadgeLabel = currentScope === 'UF' && selectedUfInfo
    ? `Recorte Estadual Ativo · ${selectedUfInfo.nome}`
    : 'Recorte Nacional Ativo';

  const scopeBadgeColor = currentScope === 'UF' ? '#F59E0B' : '#3B82F6';
  const scopeBadgeBg = currentScope === 'UF' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)';

  const scopeTitle = currentScope === 'UF' && selectedUfInfo
    ? `${selectedUfInfo.nome} · ${selectedUfInfo.regiao}`
    : '4 Verticais Unificadas · Brasil';

  const municipalityCount = currentScope === 'UF' && selectedUfInfo
    ? `${selectedUfInfo.municipios || '—'} municípios oficiais`
    : '5.570 Municípios Oficiais Cobertos';

  return (
    <div data-ui-version="mockup-approved-v1" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #090D16)', position: 'relative', overflow: 'hidden' }}>
      {isMobile ? (
        <>
          <div
            style={{
              position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.5)', zIndex: 200,
              opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'auto' : 'none',
              transition: 'opacity 0.2s',
            }}
            onClick={() => setSidebarOpen(false)}
          />
          <aside style={{
            position: 'fixed', top: 0, left: 0, height: '100vh', width: 280,
            background: 'var(--bg-sidebar, #0F172A)', zIndex: 201,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease', display: 'flex', flexDirection: 'column',
            borderRight: '1px solid var(--border-default, #1E293B)', overflow: 'hidden',
          }}>
            <MobileSidebarContent onCloseMobile={() => setSidebarOpen(false)} />
          </aside>
        </>
      ) : (
        <DesktopSidebar />
      )}

      <div style={{
        marginLeft: isMobile ? 0 : 'var(--sidebar-w, 240px)',
        flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100vw',
      }}>
        <header style={{
          height: 'var(--topbar-h, 60px)', background: 'var(--bg-surface, #0F172A)',
          borderBottom: '1px solid var(--border-default, #1E293B)', display: 'flex', alignItems: 'center',
          padding: isMobile ? '0 12px' : '0 24px', gap: isMobile ? 8 : 16, position: 'sticky', top: 0, zIndex: 50,
        }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
              <Menu size={20} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: 'var(--text-primary, #F8FAFC)', margin: 0 }}>Visão Geral</h1>
            {!isMobile && <p style={{ fontSize: 11, color: 'var(--text-tertiary, #64748B)', margin: 0, marginTop: 1 }}>Central Executiva Multivertical · WiNS Hub</p>}
          </div>

          <BrazilUfSelect
            value={selectedUf}
            onChange={handleUfChange}
            showAllLabel="Brasil (27 UFs)"
          />

          <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: isMobile ? 120 : 200, flexShrink: 0 }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isMobile ? 'Buscar…' : 'Buscar no WiNS Hub…'}
              style={{
                width: '100%', height: 32, paddingLeft: 28, fontSize: 11,
                background: 'var(--bg-base, #090D16)', border: '1px solid var(--border-subtle, #334155)',
                borderRadius: 6, color: 'var(--text-secondary, #94A3B8)',
              }}
            />
          </form>

          <button
            onClick={() => exportService.printDossierReport({ type: 'obra', title: 'Visão Geral Executiva 360°', generatedAt: new Date().toLocaleString('pt-BR') })}
            style={{
              height: 32, padding: '0 12px', fontSize: 11, fontWeight: 600,
              background: '#8B5CF6', color: '#FFF', border: 'none', borderRadius: 6,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            }}
          >
            <Download size={13} />
            {!isMobile && <span>Exportar Dossiê 360°</span>}
          </button>
        </header>

        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div className="spinner" />
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 8 }}>{loadingMessage}</p>
            </div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <AlertTriangle size={32} color="#EF4444" />
              <p style={{ color: '#EF4444', fontSize: 12, marginTop: 8 }}>{error}</p>
              <button onClick={() => setSelectedUf(prev => prev)} style={{ marginTop: 8, height: 28, padding: '0 12px', fontSize: 11, background: '#3B82F6', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              <div style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, background: scopeBadgeBg, color: scopeBadgeColor, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                      {scopeBadgeLabel}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Atualizado em 24/07/2026 · 19:49 BRT</span>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '6px 0 2px 0' }}>
                    {scopeTitle} · {municipalityCount}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                    Fontes ativas: Receita Federal (RFB), ANTT RNTRC, Ministério da Saúde (CNES), CAR/Mapbiomas e Órgãos Estaduais.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Completude Geral</span>
                    <strong style={{ color: '#22C55E' }}>98,4% auditada</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Chaves Válidas</span>
                    <strong style={{ color: '#8B5CF6' }}>1.240.000 CNPJs</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
                {kpis.map((k, idx) => (
                  <div
                    key={idx}
                    onClick={() => navigate(k.route)}
                    style={{
                      background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)',
                      borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{k.label}</span>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <k.icon size={13} color={k.color} />
                      </div>
                    </div>
                    <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{k.value}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{k.sub}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={16} color="#3B82F6" />
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Mapa Operacional Multivertical</h3>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>({filteredEntities.length} entidades no viewport)</span>
                  </div>

                  <div style={{ display: 'flex', gap: 10, fontSize: 11, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: VERT_COLORS.engenharia, cursor: 'pointer', fontWeight: 600 }}>
                      <input type="checkbox" checked={layers.engenharia} onChange={e => setLayers({ ...layers, engenharia: e.target.checked })} /> Engenharia
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: VERT_COLORS.agro, cursor: 'pointer', fontWeight: 600 }}>
                      <input type="checkbox" checked={layers.agro} onChange={e => setLayers({ ...layers, agro: e.target.checked })} /> Agro
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: VERT_COLORS.logistica, cursor: 'pointer', fontWeight: 600 }}>
                      <input type="checkbox" checked={layers.logistica} onChange={e => setLayers({ ...layers, logistica: e.target.checked })} /> Logística
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: VERT_COLORS.saude, cursor: 'pointer', fontWeight: 600 }}>
                      <input type="checkbox" checked={layers.saude} onChange={e => setLayers({ ...layers, saude: e.target.checked })} /> Saúde
                    </label>
                    <button onClick={handleResetMap} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}>
                      <RotateCcw size={10} style={{ display: 'inline', marginRight: 4 }} /> Resetar Enquadramento
                    </button>
                  </div>
                </div>

                <div style={{ height: 420, borderRadius: 8, overflow: 'hidden', position: 'relative', border: '1px solid var(--border-subtle)' }}>
                  <MapContainer center={BRAZIL_CENTER} zoom={BRAZIL_ZOOM_DESKTOP} style={{ height: '100%', width: '100%', background: '#090D16' }} zoomControl={true}>
                    <FitBoundsControl mapRef={mapRef} isMobile={isMobile} />
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; WiNS Hub'
                    />
                    {filteredEntities.map(e => {
                      const color = VERT_COLORS[e.vertical as keyof typeof VERT_COLORS] || '#3B82F6';
                      return (
                        <CircleMarker
                          key={e.id}
                          center={[e.latitude, e.longitude]}
                          radius={selectedEntity?.id === e.id ? 10 : 6}
                          pathOptions={{ fillColor: color, color: '#FFF', weight: selectedEntity?.id === e.id ? 2 : 1, fillOpacity: 0.85 }}
                          eventHandlers={{ click: () => setSelectedEntity(e) }}
                        >
                          <Tooltip direction="top" offset={[0, -6]} opacity={0.9}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#0F172A' }}>
                              {e.name}<br />
                              <span style={{ fontSize: 9, color: '#475569' }}>{e.municipality}, {e.uf} ({e.vertical})</span>
                            </div>
                          </Tooltip>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>

                  <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(15,23,42,0.9)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-subtle)', display: 'flex', gap: 12, fontSize: 10, zIndex: 1000 }}>
                    <span style={{ color: VERT_COLORS.engenharia, fontWeight: 600 }}>● Engenharia (Azul)</span>
                    <span style={{ color: VERT_COLORS.agro, fontWeight: 600 }}>● Agro (Verde)</span>
                    <span style={{ color: VERT_COLORS.logistica, fontWeight: 600 }}>● Logística (Laranja)</span>
                    <span style={{ color: VERT_COLORS.saude, fontWeight: 600 }}>● Saúde (Rosa)</span>
                  </div>

                  {selectedEntity && (
                    <div style={{
                      position: 'absolute', top: 12, right: 12, width: 280, background: 'var(--bg-surface, #0F172A)',
                      border: '1px solid #8B5CF6', borderRadius: 8, padding: 14, zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: VERT_COLORS[selectedEntity.vertical as keyof typeof VERT_COLORS], background: 'rgba(139,92,246,0.15)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
                          {selectedEntity.vertical} · {selectedEntity.kind}
                        </span>
                        <button onClick={() => setSelectedEntity(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                      </div>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0 2px 0' }}>{selectedEntity.name}</h4>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>{selectedEntity.municipality}, {selectedEntity.uf}</p>
                      <button
                        onClick={() => navigate(`/empresas/00000000000191`)}
                        style={{ width: '100%', height: 28, fontSize: 11, fontWeight: 600, background: '#8B5CF6', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                      >
                        <span>Abrir Ficha 360°</span> <ArrowRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Target size={16} color="#F59E0B" />
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Oportunidades Prioritárias do Recorte</h3>
                  </div>
                  <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>Score de Propensão ≥ 85</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { title: 'Contratação de Frete Caçamba', target: 'Alvará Curitiba - LUMINA', mun: 'Curitiba/PR', vert: 'Logística ↔ Engenharia', score: 94, classif: 'PROVÁVEL', date: '24/07/2026', rationale: 'Demanda contínua de insumos em fase inicial de pavimentação.' },
                    { title: 'Licenciamento CAR & Cascalheira', target: 'Fazenda Vale Verde', mun: 'Curitiba/PR', vert: 'Agro ↔ Engenharia', score: 89, classif: 'POTENCIAL', date: '24/07/2026', rationale: 'Reserva mineral cadastrada limítrofe ao traçado da infraestrutura.' },
                    { title: 'Expansão de Leitos UTI SUS', target: 'Hospital Municipal Curitiba', mun: 'Curitiba/PR', vert: 'Saúde ↔ Empresas', score: 91, classif: 'PROVÁVEL', date: '24/07/2026', rationale: 'Município em deserto médico relativo com verba de ampliação.' },
                  ].map((op, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: op.classif === 'PROVÁVEL' ? '#06B6D4' : '#F59E0B', background: 'rgba(6,182,212,0.12)', padding: '2px 6px', borderRadius: 4 }}>
                          {op.classif} ({op.score}%)
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{op.date}</span>
                      </div>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{op.title}</h4>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Alvo: <strong>{op.target}</strong> ({op.mun})</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{op.rationale}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} color="#22C55E" />
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Matriz de Relações Cross-Domain</h3>
                  </div>
                  <span style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>Hierarquia de Confiança Documental</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { pair: 'Engenharia ↔ Logística', orig: 'LUMINA GESTAO ➔ LOGISTICA CORREDOR SUL', classif: 'CONFIRMADO', conf: 98.5, ev: 'CNPJ Completo idêntico em contrato social da ANTT', source: 'RFB + RNTRC' },
                    { pair: 'Agro ↔ Logística', orig: 'FAZENDA VALE VERDE ➔ TRANSPORTES GRAIS', classif: 'PROVÁVEL', conf: 88.0, ev: 'CNPJ Raiz 00.000.000 coincidente com Cadastro CAR', source: 'CAR + ANTT' },
                    { pair: 'Saúde ↔ Empresas', orig: 'HOSPITAL MUNICIPAL ➔ LUMINA GESTAO', classif: 'POTENCIAL', conf: 75.0, ev: 'Geofence municipal + CNAE de infraestrutura hospitalar', source: 'CNES + RFB' },
                  ].map((rel, idx) => (
                    <div key={idx} style={{ padding: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 11 }}>
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{rel.pair}</strong>: {rel.orig}
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Evidência: {rel.ev} (Fonte: {rel.source})</div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        color: rel.classif === 'CONFIRMADO' ? '#22C55E' : rel.classif === 'PROVÁVEL' ? '#06B6D4' : '#F59E0B',
                        background: rel.classif === 'CONFIRMADO' ? 'rgba(34,197,94,0.15)' : 'rgba(6,182,212,0.15)',
                      }}>
                        {rel.classif} ({rel.conf}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <AlertTriangle size={16} color="#EC4899" />
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Eventos e Alertas Territoriais</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                    <div style={{ padding: 8, background: 'rgba(236,72,153,0.1)', border: '1px solid #EC4899', borderRadius: 6, color: '#F472B6' }}>
                      <strong>Alerta de Saúde:</strong> 14 municípios no Paraná com índice crítico de Deserto Médico (&lt;0.5 leitos/mil hab).
                    </div>
                    <div style={{ padding: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid #3B82F6', borderRadius: 6, color: '#60A5FA' }}>
                      <strong>Atualização de Obra:</strong> Alvará Curitiba - LUMINA teve estágio atualizado para 50% de execução física.
                    </div>
                    <div style={{ padding: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid #F59E0B', borderRadius: 6, color: '#FBBF24' }}>
                      <strong>Logística ANTT:</strong> 1.240 novos veículos cadastrados no diretório RNTRC no último ciclo.
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <Building2 size={16} color="#8B5CF6" />
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Resumo por Vertical</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11 }}>
                    <div style={{ padding: 8, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                      <strong style={{ color: VERT_COLORS.engenharia }}>🏗️ Engenharia</strong>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmt(counts.works)} Obras · {fmt(counts.confirmedRelations)} CAPEX Estimado</div>
                    </div>
                    <div style={{ padding: 8, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                      <strong style={{ color: VERT_COLORS.agro }}>🌾 Agro</strong>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmt(counts.ruralProperties)} Imóveis CAR · 215k Mapbiomas</div>
                    </div>
                    <div style={{ padding: 8, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                      <strong style={{ color: VERT_COLORS.logistica }}>🚚 Logística</strong>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmt(counts.carriers)} RNTRC · 636k Frotas</div>
                    </div>
                    <div style={{ padding: 8, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                      <strong style={{ color: VERT_COLORS.saude }}>🏥 Saúde</strong>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmt(counts.healthEstablishments)} CNES · 341k Ativos</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-default, #1E293B)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 10, color: 'var(--text-tertiary)' }}>
                <div>
                  <strong>Proveniência dos Dados:</strong> Receita Federal RFB, ANTT RNTRC, CNES Ministério da Saúde, CAR/Mapbiomas.
                </div>
                <div>
                  WiNS Hub Corporativo v2.4.0 · Registro auditável imutável
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
