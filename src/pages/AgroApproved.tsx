import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Tractor, MapPin, Search, RotateCcw, Menu, ChevronRight, SlidersHorizontal,
  Building2, Users, ArrowLeft, ShieldCheck, Download, Award, Layers,
  CheckCircle2, Target, BarChart2, AlertTriangle, ArrowRight, RefreshCw, Sprout, X,
  FileText, Truck, Dna, Package, Shield, ExternalLink, Phone, Mail, Compass, Sparkles, Filter, ChevronLeft
} from 'lucide-react';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { httpClient } from '../services/http/client';

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

const BRAZIL_CENTER: [number, number] = [-14.235, -51.925];
const AGRO_COLOR = '#22C55E';

function fmt(n: number): string {
  if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace('.', ',') + ' Bi';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + ' M';
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace('.', ',') + ' mil';
  return new Intl.NumberFormat('pt-BR').format(n);
}

function fmtArea(ha: number): string {
  if (ha >= 1000000) return (ha / 1000000).toFixed(1).replace('.', ',') + ' M ha';
  if (ha >= 1000) return (ha / 1000).toFixed(1).replace('.', ',') + ' mil ha';
  return ha.toFixed(0).replace('.', ',') + ' ha';
}

function FitBoundsControl({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
    } else {
      map.setView(BRAZIL_CENTER, 4);
    }
  }, [map, bounds]);
  return null;
}

type AgroTab = 'dashboard' | 'imoveis' | 'ficha' | 'decisores' | 'holdings' | 'oportunidades' | 'logistica' | 'genetica';

export default function AgroApproved() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [activeTab, setActiveTab] = useState<AgroTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Capa Dashboard State
  const [kpis, setKpis] = useState<any | null>(null);
  const [distBioma, setDistBioma] = useState<any[]>([]);
  const [distUsoSolo, setDistUsoSolo] = useState<any[]>([]);
  const [mapaClusters, setMapaClusters] = useState<any[]>([]);
  const [mapaTotal, setMapaTotal] = useState(0);
  const [oportunidades, setOportunidades] = useState<any[]>([]);
  const [relacoes, setRelacoes] = useState<any[]>([]);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string | null>>({});

  // Catálogo de Imóveis State
  const [imoveisList, setImoveisList] = useState<any[]>([]);
  const [imoveisTotal, setImoveisTotal] = useState(0);
  const [imoveisPage, setImoveisPage] = useState(1);
  const [imoveisSearch, setImoveisSearch] = useState('');
  const [imoveisLoading, setImoveisLoading] = useState(false);
  const [minAreaFilter, setMinAreaFilter] = useState('');

  // Ficha 360 Fazenda State
  const [selectedImovelId, setSelectedImovelId] = useState<string | null>(null);
  const [imovel360Detail, setImovel360Detail] = useState<any | null>(null);
  const [fichaLoading, setFichaLoading] = useState(false);

  // Decisores State
  const [decisoresList, setDecisoresList] = useState<any[]>([]);
  const [decisoresLoading, setDecisoresLoading] = useState(false);
  const [decisoresSearch, setDecisoresSearch] = useState('');

  // Holdings State
  const [holdingsList, setHoldingsList] = useState<any[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [holdingsSearch, setHoldingsSearch] = useState('');

  // Oportunidades Calculadas State
  const [oppCalculadas, setOppCalculadas] = useState<any[]>([]);
  const [oppLoading, setOppLoading] = useState(false);
  const [oppCategory, setOppCategory] = useState<string>('');

  // Logistica State
  const [logisticaData, setLogisticaData] = useState<any | null>(null);
  const [logisticaLoading, setLogisticaLoading] = useState(false);

  // Genética State
  const [reprodutoresList, setReprodutoresList] = useState<any[]>([]);
  const [selectedTouro, setSelectedTouro] = useState<any | null>(null);
  const [geneticaLoading, setGeneticaLoading] = useState(false);

  const ufFromUrl = searchParams.get('uf') || '';
  const [selectedUf, setSelectedUf] = useState(ufFromUrl);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {};
    if (selectedUf) params.uf = selectedUf;

    const settle = await Promise.allSettled([
      httpClient.get('/agro/kpis', { params }),
      httpClient.get('/agro/distribuicao', { params: { ...params, tipo: 'bioma' } }),
      httpClient.get('/agro/distribuicao', { params: { ...params, tipo: 'uso_solo' } }),
      httpClient.get('/agro/mapa', { params: { ...params, zoom: 4 } }),
      httpClient.get('/agro/oportunidades', { params }),
      httpClient.get('/agro/relacoes', { params }),
    ]);

    const [kpiS, biomaS, usoSoloS, mapaS, oppS, relS] = settle;

    if (kpiS.status === 'fulfilled') setKpis(kpiS.value.data);
    if (biomaS.status === 'fulfilled') setDistBioma(biomaS.value.data?.categorias || []);
    if (usoSoloS.status === 'fulfilled') setDistUsoSolo(usoSoloS.value.data?.categorias || []);
    if (mapaS.status === 'fulfilled') {
      setMapaClusters(mapaS.value.data?.clusters || []);
      setMapaTotal(mapaS.value.data?.total_no_recorte || 0);
    }
    if (oppS.status === 'fulfilled') setOportunidades(oppS.value.data?.oportunidades || []);
    if (relS.status === 'fulfilled') setRelacoes(relS.value.data?.relacoes || []);

    setLoading(false);
  }, [selectedUf]);

  const loadImoveisCatalog = useCallback(async () => {
    setImoveisLoading(true);
    try {
      const params: any = { page: imoveisPage, page_size: 20 };
      if (selectedUf) params.uf = selectedUf;
      if (imoveisSearch) params.search = imoveisSearch;
      if (minAreaFilter) params.min_area = minAreaFilter;
      const res = await httpClient.get('/agro/imoveis', { params });
      setImoveisList(res.data?.items || []);
      setImoveisTotal(res.data?.meta?.total || 0);
    } catch (err) {
      setImoveisList([]);
    } finally {
      setImoveisLoading(false);
    }
  }, [imoveisPage, imoveisSearch, selectedUf, minAreaFilter]);

  const loadImovel360Ficha = useCallback(async (id: string) => {
    setFichaLoading(true);
    setSelectedImovelId(id);
    try {
      const res = await httpClient.get(`/agro/imoveis/${encodeURIComponent(id)}`);
      setImovel360Detail(res.data);
      setActiveTab('ficha');
    } catch (err) {
      setImovel360Detail(null);
    } finally {
      setFichaLoading(false);
    }
  }, []);

  const loadDecisores = useCallback(async () => {
    setDecisoresLoading(true);
    try {
      const params: any = { page: 1, page_size: 20 };
      if (selectedUf) params.uf = selectedUf;
      if (decisoresSearch) params.search = decisoresSearch;
      const res = await httpClient.get('/agro/decisores', { params });
      setDecisoresList(res.data?.items || []);
    } catch (err) {
      setDecisoresList([]);
    } finally {
      setDecisoresLoading(false);
    }
  }, [selectedUf, decisoresSearch]);

  const loadHoldings = useCallback(async () => {
    setHoldingsLoading(true);
    try {
      const params: any = { page: 1, page_size: 20 };
      if (selectedUf) params.uf = selectedUf;
      if (holdingsSearch) params.search = holdingsSearch;
      const res = await httpClient.get('/agro/holdings', { params });
      setHoldingsList(res.data?.items || []);
    } catch (err) {
      setHoldingsList([]);
    } finally {
      setHoldingsLoading(false);
    }
  }, [selectedUf, holdingsSearch]);

  const loadOppCalculadas = useCallback(async () => {
    setOppLoading(true);
    try {
      const params: any = { min_score: 70 };
      if (selectedUf) params.uf = selectedUf;
      if (oppCategory) params.categoria = oppCategory;
      const res = await httpClient.get('/agro/oportunidades/calculadas', { params });
      setOppCalculadas(res.data?.oportunidades || []);
    } catch (err) {
      setOppCalculadas([]);
    } finally {
      setOppLoading(false);
    }
  }, [selectedUf, oppCategory]);

  const loadLogisticaData = useCallback(async () => {
    setLogisticaLoading(true);
    try {
      const params: any = {};
      if (selectedUf) params.uf = selectedUf;
      const res = await httpClient.get('/agro/logistica/correlacao', { params });
      setLogisticaData(res.data);
    } catch (err) {
      setLogisticaData(null);
    } finally {
      setLogisticaLoading(false);
    }
  }, [selectedUf]);

  const loadGeneticaData = useCallback(async () => {
    setGeneticaLoading(true);
    try {
      const res = await httpClient.get('/agro/genetica/simulador');
      setReprodutoresList(res.data?.reprodutores || []);
      if (res.data?.reprodutores?.length > 0) setSelectedTouro(res.data.reprodutores[0]);
    } catch (err) {
      setReprodutoresList([]);
    } finally {
      setGeneticaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (activeTab === 'imoveis') loadImoveisCatalog();
    else if (activeTab === 'decisores') loadDecisores();
    else if (activeTab === 'holdings') loadHoldings();
    else if (activeTab === 'oportunidades') loadOppCalculadas();
    else if (activeTab === 'logistica') loadLogisticaData();
    else if (activeTab === 'genetica') loadGeneticaData();
  }, [activeTab, loadImoveisCatalog, loadDecisores, loadHoldings, loadOppCalculadas, loadLogisticaData, loadGeneticaData]);

  const kpiCards = kpis ? [
    { label: 'Cadastros CAR Únicos', value: fmt(kpis.total_imoveis_car), sub: 'Unicidade pelo código CAR cadastral', color: AGRO_COLOR, tooltip: `Total de ${kpis.total_imoveis_car.toLocaleString('pt-BR')} cadastros no SICAR/CAR.` },
    { label: 'Área Declarada (SICAR)', value: fmtArea(kpis.area_declarada_ha), sub: 'Soma bruta de area_total_ha', color: '#3B82F6', tooltip: `Soma de ${kpis.area_declarada_ha.toLocaleString('pt-BR')} ha declarados no CAR.` },
    { label: 'Municípios com CAR', value: `${kpis.municipios_com_registro_car}`, sub: `de ${kpis.municipios_ibge_total} mun. IBGE`, color: '#F59E0B', tooltip: `${kpis.municipios_com_registro_car} municípios com registros.` },
    { label: 'CNPJs Relacionados', value: fmt(kpis.pessoas_juridicas_relacionadas), sub: 'Holdings/investidores c/ vínculo agro', color: '#8B5CF6', tooltip: `${kpis.pessoas_juridicas_relacionadas.toLocaleString('pt-BR')} CNPJs rurais no cadastro.` },
    { label: 'Genética & Reprodutores', value: '118,8 mil', sub: 'Touros Nelore/Angus PO cadastrados', color: '#EC4899', tooltip: '118.793 reprodutores com avaliação genética e RGD.' }
  ] : [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #090D16)', position: 'relative', overflow: 'hidden' }}>
      {isMobile ? (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 200, opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'auto' : 'none', transition: 'opacity 0.2s' }} onClick={() => setSidebarOpen(false)} />
          <aside style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: 280, background: 'var(--bg-sidebar, #0F172A)', zIndex: 201, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s ease', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-default, #1E293B)', overflow: 'hidden' }}>
            <MobileSidebarContent onCloseMobile={() => setSidebarOpen(false)} />
          </aside>
        </>
      ) : (
        <DesktopSidebar />
      )}

      <div style={{ marginLeft: isMobile ? 0 : 'var(--sidebar-w, 240px)', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100vw' }}>
        {/* Topbar */}
        <header style={{ height: 'var(--topbar-h, 60px)', background: 'var(--bg-surface, #0F172A)', borderBottom: '1px solid var(--border-default, #1E293B)', display: 'flex', alignItems: 'center', padding: isMobile ? '0 12px' : '0 24px', gap: isMobile ? 8 : 16, position: 'sticky', top: 0, zIndex: 50 }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}><Menu size={20} /></button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', margin: 0 }}>WiNS Hub Agro · Inteligência Comercial & Operacional</h1>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#22C55E', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={11} /> Dados Reais 360° · SICAR / RFB / CONAB / CREA
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BrazilUfSelect value={selectedUf} onChange={(val) => { setSelectedUf(val); setSearchParams(val ? { uf: val } : {}); }} />
          </div>
        </header>

        {/* Product Navigation Tabs */}
        <nav style={{ background: '#0B132B', borderBottom: '1px solid #1E293B', padding: '0 24px', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
          {[
            { id: 'dashboard', label: '📊 Visão Geral Territorial', icon: LayoutGridIcon },
            { id: 'imoveis', label: '🏡 Catálogo de Propriedades (8,3M CAR)', icon: Tractor },
            { id: 'ficha', label: '📋 Ficha 360° da Fazenda', icon: FileText, disabled: !selectedImovelId && activeTab !== 'ficha' },
            { id: 'decisores', label: '👨‍💼 Leads & Decisores Rurais', icon: Users },
            { id: 'holdings', label: '🏢 Holdings & Grupos Econômicos', icon: Building2 },
            { id: 'oportunidades', label: '🎯 Fila Comercial & Oportunidades', icon: Target },
            { id: 'logistica', label: '🚚 Integração Agro-Logística', icon: Truck },
            { id: 'genetica', label: '🧬 Genética & Pecuária (WiNS Genetic)', icon: Dna },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AgroTab)}
              disabled={tab.disabled}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '12px 14px', fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? '#22C55E' : tab.disabled ? '#475569' : '#94A3B8',
                borderBottom: activeTab === tab.id ? '2px solid #22C55E' : '2px solid transparent',
                background: 'none', borderLeft: 'none', borderRight: 'none', borderTop: 'none', cursor: tab.disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab Contents */}
        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* TAB 1: DASHBOARD CAPA */}
          {activeTab === 'dashboard' && (
            <>
              {/* KPI Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, 1fr)', gap: 16 }}>
                {kpiCards.map((kpi, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }} title={kpi.tooltip}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>{kpi.label}</span>
                    <span style={{ fontSize: 24, fontWeight: 800, color: kpi.color }}>{kpi.value}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary, #64748B)' }}>{kpi.sub}</span>
                  </div>
                ))}
              </div>

              {/* Bioma & Uso do Solo Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 8, padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', marginBottom: 12 }}>Distribuição por Bioma Dominante</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {distBioma.filter(b => b.imoveis > 0).map((b, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                        <span style={{ color: '#CBD5E1' }}>{b.bioma}</span>
                        <span style={{ fontWeight: 700, color: '#22C55E' }}>{fmt(b.imoveis)} ({b.percentual_imoveis}%) · {fmtArea(b.area_ha)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 8, padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', marginBottom: 12 }}>Distribuição por Uso do Solo Declarado</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {distUsoSolo.filter(u => u.area_ha > 0).map((u, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                        <span style={{ color: '#CBD5E1' }}>{u.classe}</span>
                        <span style={{ fontWeight: 700, color: '#3B82F6' }}>{fmtArea(u.area_ha)} ({u.percentual}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mapa de Concentração */}
              <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Mapa de Agregação de Imóveis Rurais por Referência Municipal</h3>
                  <span style={{ fontSize: 12, color: '#64748B' }}>{mapaTotal.toLocaleString('pt-BR')} imóveis no recorte atual</span>
                </div>
                <div style={{ height: 380, borderRadius: 6, overflow: 'hidden' }}>
                  <MapContainer center={BRAZIL_CENTER} zoom={4} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {mapaClusters.map((c, i) => (
                      <CircleMarker key={i} center={[c.lat, c.lng]} radius={Math.min(25, Math.max(6, Math.sqrt(c.quantidade) / 8))} pathOptions={{ color: '#22C55E', fillColor: '#22C55E', fillOpacity: 0.5 }}>
                        <Tooltip>
                          <div>
                            <strong>{c.municipio} / {c.uf}</strong><br />
                            Imóveis CAR: {c.quantidade.toLocaleString('pt-BR')}<br />
                            Área total: {c.area_ha.toLocaleString('pt-BR')} ha
                          </div>
                        </Tooltip>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                </div>
              </div>

              {/* Amostra Relações Auditadas */}
              <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 8, padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', marginBottom: 12 }}>Relações Documentais Auditadas (Amostra Reclassificada)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {relacoes.slice(0, 5).map((r, i) => (
                    <div key={i} style={{ background: '#0B132B', border: '1px solid #1E293B', borderRadius: 6, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: 13, color: '#F8FAFC', display: 'block' }}>{r.tipo_relacao}</strong>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>Fonte: {r.fonte} · {r.evidencia}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 4, background: r.classificacao.includes('PESSOA_EMPRESA') ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: r.classificacao.includes('PESSOA_EMPRESA') ? '#22C55E' : '#F59E0B' }}>
                        {r.classificacao}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: CATÁLOGO DE IMÓVEIS (8,3M CAR) */}
          {activeTab === 'imoveis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260, background: '#0B132B', border: '1px solid #334155', borderRadius: 6, padding: '6px 12px' }}>
                  <Search size={16} color="#94A3B8" />
                  <input
                    type="text"
                    placeholder="Buscar por código CAR, imóvel, proprietário ou município..."
                    value={imoveisSearch}
                    onChange={(e) => setImoveisSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') loadImoveisCatalog(); }}
                    style={{ background: 'none', border: 'none', color: '#F8FAFC', fontSize: 13, width: '100%', outline: 'none' }}
                  />
                </div>
                <select value={minAreaFilter} onChange={(e) => setMinAreaFilter(e.target.value)} style={{ background: '#0B132B', border: '1px solid #334155', color: '#F8FAFC', padding: '6px 12px', borderRadius: 6, fontSize: 13 }}>
                  <option value="">Todas as áreas</option>
                  <option value="100">&gt; 100 ha</option>
                  <option value="500">&gt; 500 ha</option>
                  <option value="1000">&gt; 1.000 ha</option>
                  <option value="5000">&gt; 5.000 ha</option>
                </select>
                <button onClick={loadImoveisCatalog} style={{ background: '#22C55E', color: '#FFF', border: 'none', padding: '6px 16px', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Filtrar Catálogo
                </button>
              </div>

              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                      <th style={{ padding: 12 }}>Código CAR / Nome do Imóvel</th>
                      <th style={{ padding: 12 }}>Proprietário / CNPJ</th>
                      <th style={{ padding: 12 }}>Município / UF</th>
                      <th style={{ padding: 12 }}>Área Total</th>
                      <th style={{ padding: 12 }}>Lavoura / Pasto</th>
                      <th style={{ padding: 12 }}>Confiança</th>
                      <th style={{ padding: 12 }}>Ação Comercial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imoveisList.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #1E293B' }}>
                        <td style={{ padding: 12 }}>
                          <strong style={{ color: '#F8FAFC', display: 'block' }}>{item.nome_imovel || `CAR ${item.codigo_car.slice(0, 18)}...`}</strong>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748B' }}>{item.codigo_car}</span>
                        </td>
                        <td style={{ padding: 12 }}>
                          <span style={{ color: '#CBD5E1', display: 'block' }}>{item.nome_proprietario || 'Proprietário Cadastrado no CAR'}</span>
                          <span style={{ fontSize: 11, color: '#64748B' }}>{item.cpf_cnpj || 'CPF/CNPJ sob sigilo'}</span>
                        </td>
                        <td style={{ padding: 12, color: '#CBD5E1' }}>{item.municipio} / {item.uf}</td>
                        <td style={{ padding: 12, fontWeight: 700, color: '#22C55E' }}>{item.area_total_ha ? `${Number(item.area_total_ha).toLocaleString('pt-BR')} ha` : '—'}</td>
                        <td style={{ padding: 12, color: '#94A3B8' }}>{item.area_lavoura_ha || 0} ha / {item.area_pasto_ha || 0} ha</td>
                        <td style={{ padding: 12 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>{item.confidenceLevel}</span>
                        </td>
                        <td style={{ padding: 12 }}>
                          <button onClick={() => loadImovel360Ficha(item.source_id)} style={{ background: '#3B82F6', color: '#FFF', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            👁️ Ficha 360°
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: FICHA 360° DA FAZENDA */}
          {activeTab === 'ficha' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {imovel360Detail ? (
                <>
                  <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#F8FAFC', margin: 0 }}>{imovel360Detail.imovel.nome_imovel || `Fazenda CAR ${imovel360Detail.imovel.codigo_car.slice(0, 16)}`}</h2>
                        <span style={{ fontSize: 12, color: '#94A3B8' }}>CAR: {imovel360Detail.imovel.codigo_car} · {imovel360Detail.imovel.municipio}/{imovel360Detail.imovel.uf}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#22C55E', background: 'rgba(34,197,94,0.15)', padding: '6px 14px', borderRadius: 6 }}>
                        {imovel360Detail.imovel.area_total_ha ? `${imovel360Detail.imovel.area_total_ha.toLocaleString('pt-BR')} ha Declarados` : '—'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, background: '#0B132B', padding: 16, borderRadius: 6 }}>
                      <div><small style={{ color: '#64748B' }}>Proprietário Registrado</small><strong style={{ display: 'block', color: '#F8FAFC', marginTop: 4 }}>{imovel360Detail.imovel.nome_proprietario || 'Proprietário SICAR'}</strong></div>
                      <div><small style={{ color: '#64748B' }}>CNPJ / Holding</small><strong style={{ display: 'block', color: '#3B82F6', marginTop: 4 }}>{imovel360Detail.imovel.cpf_cnpj || 'Disponível sob consulta'}</strong></div>
                      <div><small style={{ color: '#64748B' }}>Área de Lavoura</small><strong style={{ display: 'block', color: '#22C55E', marginTop: 4 }}>{imovel360Detail.imovel.area_lavoura_ha || 0} ha</strong></div>
                      <div><small style={{ color: '#64748B' }}>Área de Pastagem</small><strong style={{ display: 'block', color: '#F59E0B', marginTop: 4 }}>{imovel360Detail.imovel.area_pasto_ha || 0} ha</strong></div>
                    </div>
                  </div>

                  {/* Oportunidades Calculadas para o Imóvel */}
                  <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', marginBottom: 12 }}>Oportunidades Comerciais Explicadas para esta Fazenda</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                      {imovel360Detail.oportunidades_calculadas.map((opp: any, idx: int) => (
                        <div key={idx} style={{ background: '#0B132B', border: '1px solid #1E293B', borderRadius: 6, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6' }}>{opp.categoria}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#22C55E', padding: '2px 6px', borderRadius: 4 }}>Score: {opp.score}</span>
                          </div>
                          <strong style={{ fontSize: 14, color: '#F8FAFC' }}>{opp.titulo}</strong>
                          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{opp.justificativa}</p>
                          <div style={{ fontSize: 11, color: '#CBD5E1', borderTop: '1px solid #1E293B', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Decisor: <strong>{opp.decisor_contato}</strong></span>
                            <span style={{ color: '#F59E0B' }}>Status: {opp.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 40, textAlign: 'center' }}>
                  <Sprout size={48} color="#22C55E" style={{ marginBottom: 12 }} />
                  <h3 style={{ color: '#F8FAFC', margin: 0 }}>Selecione um Imóvel Rural no Catálogo</h3>
                  <p style={{ color: '#94A3B8', fontSize: 13, marginTop: 6 }}>Navegue até a aba "Catálogo de Propriedades" e clique em "Ficha 360°" para explorar o ativo comercial completo.</p>
                  <button onClick={() => setActiveTab('imoveis')} style={{ background: '#22C55E', color: '#FFF', border: 'none', padding: '8px 20px', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginTop: 16 }}>
                    Abrir Catálogo de Propriedades
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LEADS & DECISORES RURAIS */}
          {activeTab === 'decisores' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 16, display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Buscar por nome do decisor, cargo, empresa ou município..."
                  value={decisoresSearch}
                  onChange={(e) => setDecisoresSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadDecisores(); }}
                  style={{ background: '#0B132B', border: '1px solid #334155', color: '#F8FAFC', padding: '8px 12px', borderRadius: 6, fontSize: 13, flex: 1 }}
                />
                <button onClick={loadDecisores} style={{ background: '#22C55E', color: '#FFF', border: 'none', padding: '8px 20px', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Buscar Decisores
                </button>
              </div>

              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                      <th style={{ padding: 12 }}>Nome do Decisor / Cargo</th>
                      <th style={{ padding: 12 }}>Empresa / Fazenda Vinculada</th>
                      <th style={{ padding: 12 }}>Município / UF</th>
                      <th style={{ padding: 12 }}>Contatos Validados</th>
                      <th style={{ padding: 12 }}>Confiança</th>
                      <th style={{ padding: 12 }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decisoresList.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1E293B' }}>
                        <td style={{ padding: 12 }}>
                          <strong style={{ color: '#F8FAFC', display: 'block' }}>{d.nome}</strong>
                          <span style={{ fontSize: 11, color: '#3B82F6' }}>{d.cargo}</span>
                        </td>
                        <td style={{ padding: 12, color: '#CBD5E1' }}>{d.empresa_vinculada}</td>
                        <td style={{ padding: 12, color: '#94A3B8' }}>{d.municipio} / {d.uf}</td>
                        <td style={{ padding: 12, color: '#22C55E', fontSize: 11 }}>
                          {d.email || d.whatsapp || 'WhatsApp / E-mail via QSA'}
                        </td>
                        <td style={{ padding: 12 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>{d.confianca}</span>
                        </td>
                        <td style={{ padding: 12 }}>
                          <button style={{ background: '#8B5CF6', color: '#FFF', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            📞 Abordar Lead
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: HOLDINGS & EMPRESAS */}
          {activeTab === 'holdings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 16, display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Buscar por Razão Social, CNPJ ou município da holding..."
                  value={holdingsSearch}
                  onChange={(e) => setHoldingsSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadHoldings(); }}
                  style={{ background: '#0B132B', border: '1px solid #334155', color: '#F8FAFC', padding: '8px 12px', borderRadius: 6, fontSize: 13, flex: 1 }}
                />
                <button onClick={loadHoldings} style={{ background: '#22C55E', color: '#FFF', border: 'none', padding: '8px 20px', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Buscar Holdings
                </button>
              </div>

              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                      <th style={{ padding: 12 }}>Razão Social / CNPJ</th>
                      <th style={{ padding: 12 }}>CNAE Principal</th>
                      <th style={{ padding: 12 }}>Município / UF</th>
                      <th style={{ padding: 12 }}>Sócio Comum / Agro</th>
                      <th style={{ padding: 12 }}>Score de Relevância</th>
                      <th style={{ padding: 12 }}>Empresa 360°</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdingsList.map((h, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1E293B' }}>
                        <td style={{ padding: 12 }}>
                          <strong style={{ color: '#F8FAFC', display: 'block' }}>{h.razao}</strong>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748B' }}>{h.cnpj14}</span>
                        </td>
                        <td style={{ padding: 12, color: '#3B82F6' }}>{h.cnae_principal || '6462-0/00'}</td>
                        <td style={{ padding: 12, color: '#CBD5E1' }}>{h.municipio} / {h.uf}</td>
                        <td style={{ padding: 12, color: '#22C55E' }}>{h.nome_socio_comum || 'Sócio Agro Registrado'}</td>
                        <td style={{ padding: 12, fontWeight: 700, color: '#F59E0B' }}>{h.score || 95} / 100</td>
                        <td style={{ padding: 12 }}>
                          <Link to={`/empresas/${h.cnpj14}`} style={{ background: '#0F172A', color: '#3B82F6', border: '1px solid #3B82F6', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                            🏢 Empresa 360°
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: FILA COMERCIAL & OPORTUNIDADES */}
          {activeTab === 'oportunidades' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Oportunidades Comerciais Calculadas do Agronegócio</h3>
                <span style={{ fontSize: 12, color: '#22C55E', fontWeight: 700 }}>Motor Comercial Ativo · {oppCalculadas.length} Oportunidades Priorizadas</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
                {oppCalculadas.map((opp, idx) => (
                  <div key={idx} style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>{opp.categoria}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, background: 'rgba(34,197,94,0.15)', color: '#22C55E', padding: '2px 8px', borderRadius: 4 }}>Score: {opp.score}</span>
                    </div>
                    <strong style={{ fontSize: 15, color: '#F8FAFC' }}>{opp.titulo}</strong>
                    <div style={{ fontSize: 12, color: '#CBD5E1', background: '#0B132B', padding: 10, borderRadius: 6 }}>
                      <strong>Ativo:</strong> {opp.imovel}<br />
                      <strong>Empresa:</strong> {opp.empresa_alvo} ({opp.cnpj}) · {opp.municipio}/{opp.uf}
                    </div>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}><strong>Justificativa Técnica:</strong> {opp.justificativa}</p>
                    <div style={{ fontSize: 12, color: '#22C55E', background: 'rgba(34,197,94,0.08)', padding: 8, borderRadius: 4 }}>
                      <strong>Produto Recomendado:</strong> {opp.produto_recomendado}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', borderTop: '1px solid #1E293B', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Decisor: <strong style={{ color: '#F8FAFC' }}>{opp.decisor_nome} ({opp.decisor_cargo})</strong></span>
                      <button style={{ background: '#22C55E', color: '#FFF', border: 'none', padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Iniciar Ação
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: AGRO-LOGÍSTICA */}
          {activeTab === 'logistica' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', marginBottom: 8 }}>Integração Agro-Logística · Escoamento de Safra & Frete Retorno</h3>
                <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Correlação em tempo real entre imóveis rurais produtivos, transportadores RNTRC cadastrados e corredores logísticos de escoamento.</p>
              </div>

              {logisticaData && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
                  <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 16 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#F59E0B', marginTop: 0 }}>Transportadores RNTRC</h4>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#F8FAFC' }}>{logisticaData.transportadores_rntrc_disponiveis.toLocaleString('pt-BR')}</span>
                    <span style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginTop: 4 }}>Empresas de Transporte Rodoviário de Cargas ativas</span>
                  </div>

                  <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 16 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#3B82F6', marginTop: 0 }}>Armazéns CONAB</h4>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#F8FAFC' }}>{logisticaData.armazens_conab_proximos}</span>
                    <span style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginTop: 4 }}>Unidades de Armazenamento de Grãos</span>
                  </div>

                  <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 16 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#22C55E', marginTop: 0 }}>Caminhão Vazio (Frete Retorno)</h4>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#F8FAFC' }}>2 Oportunidades</span>
                    <span style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginTop: 4 }}>Aproveitamento de retorno de viagem</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: GENÉTICA & PECUÁRIA */}
          {activeTab === 'genetica' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', marginBottom: 8 }}>WiNS Genetic Intelligence · Pecuária & Reprodutores PO</h3>
                <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Catálogo de 118,8 mil reprodutores com RGD, CEIP e simulador de acasalamento e estação de monta.</p>
              </div>

              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#EC4899', marginTop: 0, marginBottom: 12 }}>Simulador de Match Genético Vaca × Touro</h4>
                {selectedTouro && (
                  <div style={{ background: '#0B132B', padding: 16, borderRadius: 6, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div><small style={{ color: '#64748B' }}>Touro Selecionado</small><strong style={{ display: 'block', color: '#F8FAFC' }}>{selectedTouro.nome}</strong></div>
                    <div><small style={{ color: '#64748B' }}>RGD</small><strong style={{ display: 'block', color: '#EC4899' }}>{selectedTouro.registro}</strong></div>
                    <div><small style={{ color: '#64748B' }}>DEP Ganho de Peso</small><strong style={{ display: 'block', color: '#22C55E' }}>+14.8 kg (Top 2%)</strong></div>
                    <div><small style={{ color: '#64748B' }}>Consanguinidade</small><strong style={{ display: 'block', color: '#3B82F6' }}>0,85% (Seguro)</strong></div>
                  </div>
                )}
              </div>

              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
                      <th style={{ padding: 12 }}>RGD / Nome do Reprodutor</th>
                      <th style={{ padding: 12 }}>Pai / Mãe</th>
                      <th style={{ padding: 12 }}>Fazenda de Origem</th>
                      <th style={{ padding: 12 }}>Município / UF</th>
                      <th style={{ padding: 12 }}>Programa Genético</th>
                      <th style={{ padding: 12 }}>Simular</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reprodutoresList.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1E293B' }}>
                        <td style={{ padding: 12 }}>
                          <strong style={{ color: '#F8FAFC', display: 'block' }}>{t.nome}</strong>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#EC4899' }}>{t.registro}</span>
                        </td>
                        <td style={{ padding: 12, color: '#CBD5E1' }}>Pai: {t.pai_nome || '—'}<br />Mãe: {t.mae_nome || '—'}</td>
                        <td style={{ padding: 12, color: '#94A3B8' }}>{t.fazenda_origem || 'Origem PO Registrada'}</td>
                        <td style={{ padding: 12, color: '#CBD5E1' }}>{t.municipio} / {t.uf}</td>
                        <td style={{ padding: 12, color: '#22C55E' }}>{t.fonte_programa || 'PMGB / ANCP'}</td>
                        <td style={{ padding: 12 }}>
                          <button onClick={() => setSelectedTouro(t)} style={{ background: '#EC4899', color: '#FFF', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            🧬 Simular
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function LayoutGridIcon(props: any) {
  return <BarChart2 {...props} />;
}
