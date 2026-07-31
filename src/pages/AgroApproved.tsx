import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Tractor, MapPin, Search, RotateCcw, Menu, ChevronRight, SlidersHorizontal,
  Building2, Users, ArrowLeft, ShieldCheck, Download, Award, Layers,
  CheckCircle2, Target, BarChart2, AlertTriangle, ArrowRight, RefreshCw, Sprout, X
} from 'lucide-react';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { httpClient } from '../services/http/client';
import { isMotorOportunidadesReal } from './agroOportunidadesContract';
import { AGRO_API } from './agroApiEndpoints';
import { AgroTerritorialMap } from '../components/AgroTerritorialMap';
import type { AgroMapResponse } from '../utils/agroMapUtils';

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

interface AgroKpis {
  total_imoveis_car: number;
  codigos_car_unicos: number;
  geometrias_validas: number;
  area_declarada_ha: number;
  area_pasto_ha: number;
  area_lavoura_ha: number;
  area_vegetacao_nativa_ha: number;
  municipios_com_registro_car: number;
  municipios_ibge_total: number;
  ufs_presentes: number;
  pessoas_juridicas_relacionadas: number;
  ultima_atualizacao: string | null;
  metodologia: Record<string, string>;
  fontes: string[];
  classificacao: string;
}

interface DistribuicaoCategoria {
  bioma?: string;
  classe?: string;
  imoveis?: number;
  area_ha?: number;
  percentual_imoveis?: number;
  percentual_area?: number;
  percentual?: number;
  fonte?: string;
}

interface MapaCluster {
  lat: number;
  lng: number;
  quantidade: number;
  municipios: number;
  municipio: string;
  uf: string;
  area_ha: number;
}

export default function AgroApproved() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<AgroKpis | null>(null);
  const [distBioma, setDistBioma] = useState<DistribuicaoCategoria[]>([]);
  const [distUsoSolo, setDistUsoSolo] = useState<DistribuicaoCategoria[]>([]);
  const [mapaClusters, setMapaClusters] = useState<MapaCluster[]>([]);
  const [mapaTotal, setMapaTotal] = useState(0);
  const [oportunidades, setOportunidades] = useState<any[]>([]);
  const [relacoes, setRelacoes] = useState<any[]>([]);
  const [oportunidadesMsg, setOportunidadesMsg] = useState<string | null>(null);
  const [relacoesMsg, setRelacoesMsg] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapResponse, setMapResponse] = useState<AgroMapResponse | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const ufFromUrl = searchParams.get('uf') || '';
  const [selectedUf, setSelectedUf] = useState(ufFromUrl);
  const [selectedBioma, setSelectedBioma] = useState('');
  const [selectedUso, setSelectedUso] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const mapAbortRef = useRef<AbortController | null>(null);

  const activeFiltersCount = [searchQuery, selectedUf, selectedBioma, selectedUso].filter(Boolean).length;

  const fetchMapaData = useCallback(async () => {
    if (mapAbortRef.current) mapAbortRef.current.abort();
    const controller = new AbortController();
    mapAbortRef.current = controller;

    setMapLoading(true);
    setMapError(null);
    try {
      const params: Record<string, string> = { zoom: '4' };
      if (selectedUf) params.uf = selectedUf;
      const res = await httpClient.get(AGRO_API.mapa, { params, signal: controller.signal });
      if (res && res.data) {
        const mapData = res.data as AgroMapResponse;
        setMapaClusters(mapData.clusters as MapaCluster[] || []);
        setMapaTotal(mapData.total_no_recorte || 0);
        setMapResponse(mapData);
        setMapError(null);
      } else {
        setMapaClusters([]);
        setMapaTotal(0);
        setMapResponse(null);
        setMapError('Não foi possível carregar o mapa territorial.');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setMapaClusters([]);
      setMapaTotal(0);
      setMapResponse(null);
      setMapError(err?.message || 'Não foi possível carregar o mapa territorial.');
    } finally {
      setMapLoading(false);
    }
  }, [selectedUf]);

  const loadAllData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setMapLoading(true);
    setMapError(null);

    try {
      const params: Record<string, string> = {};
      if (selectedUf) params.uf = selectedUf;

      const results = await Promise.allSettled([
        httpClient.get(AGRO_API.kpis, { params, signal: controller.signal }),
        httpClient.get(AGRO_API.distribuicao, { params: { ...params, tipo: 'bioma' }, signal: controller.signal }),
        httpClient.get(AGRO_API.distribuicao, { params: { ...params, tipo: 'uso_solo' }, signal: controller.signal }),
        httpClient.get(AGRO_API.mapa, { params: { ...params, zoom: 4 }, signal: controller.signal }),
        httpClient.get(AGRO_API.oportunidades, { params, signal: controller.signal }),
        httpClient.get(AGRO_API.relacoes, { params, signal: controller.signal }),
      ]);

      if (controller.signal.aborted) return;

      const getData = (idx: number, fallback: any = {}) => {
        const r = results[idx];
        return (r.status === 'fulfilled' && r.value && r.value.data) ? r.value.data : fallback;
      };

      const kpiData = getData(0, null);
      const biomaData = getData(1, {});
      const usoSoloData = getData(2, {});
      const oppData = getData(4, {});
      const relData = getData(5, {});

      setKpis(kpiData);

      const biomaCats = biomaData?.categorias || [];
      const usoSoloCats = usoSoloData?.categorias || [];
      setDistBioma(biomaCats);
      setDistUsoSolo(usoSoloCats);

      // Tratamento isolado do resultado do Mapa (índice 3)
      const mapaResult = results[3];
      if (mapaResult.status === 'fulfilled' && mapaResult.value && mapaResult.value.data) {
        const mapData = mapaResult.value.data as AgroMapResponse;
        setMapaClusters(mapData.clusters as MapaCluster[] || []);
        setMapaTotal(mapData.total_no_recorte || 0);
        setMapResponse(mapData);
        setMapError(null);
      } else {
        setMapaClusters([]);
        setMapaTotal(0);
        setMapResponse(null);
        const errMsg = mapaResult.status === 'rejected'
          ? (mapaResult.reason?.message || 'Não foi possível carregar o mapa territorial.')
          : 'Não foi possível carregar o mapa territorial.';
        setMapError(errMsg);
      }
      setMapLoading(false);

      if (oppData?.message || !isMotorOportunidadesReal(oppData?.oportunidades)) {
        setOportunidades([]);
        setOportunidadesMsg(oppData?.message || 'Oportunidades ainda não calculadas para este recorte.');
      } else {
        setOportunidades(oppData?.oportunidades || []);
        setOportunidadesMsg(null);
      }

      if (relData?.message) {
        setRelacoes([]);
        setRelacoesMsg(relData.message);
      } else {
        setRelacoes(relData?.relacoes || []);
        setRelacoesMsg(null);
      }

      setLoading(false);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err?.message || 'Falha ao carregar dados do Agro');
      setLoading(false);
      setMapLoading(false);
    }
  }, [selectedUf]);

  useEffect(() => {
    loadAllData();
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (mapAbortRef.current) mapAbortRef.current.abort();
    };
  }, [loadAllData]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedUf) next.set('uf', selectedUf);
    else next.delete('uf');
    setSearchParams(next, { replace: true });
  }, [selectedUf, setSearchParams]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedUf('');
    setSelectedBioma('');
    setSelectedUso('');
  };

  const navCards = [
    { label: "🏡 Propriedades Rurais", desc: "Catálogo server-side com CAR, área, bioma, proprietário e CNPJ — acesse a Ficha 360° a partir da tabela", route: "/agro/propriedades", color: "#22C55E" },
    { label: "👨‍💼 Leads e Decisores", desc: "Catálogo com nome, cargo, contato, validação, fonte e score", route: "/agro/leads", color: "#8B5CF6" },
    { label: "🏢 Holdings & Grupos", desc: "Razão social, CNPJ, propriedades, empresas do grupo e força da relação", route: "/agro/holdings", color: "#F59E0B" },
    { label: "🎯 Oportunidades", desc: "Fila comercial com score, categoria, evidência e próximo passo", route: "/agro/oportunidades", color: "#EC4899", badge: "Em validação" },
    { label: "🚚 Agro–Logística", desc: "Transportadores RNTRC, armazéns, distâncias e correlações", route: "/agro/logistica", color: "#06B6D4" },
    { label: "🧬 Genética & Pecuária", desc: "Base de reprodutores com RGD, CEIP e simulador de acasalamento", route: "/agro/genetica", color: "#A855F7" },
  ];

  const kpiCards = kpis ? [
    { label: 'Cadastros CAR Únicos', value: fmt(kpis.total_imoveis_car), sub: 'Unicidade pelo código CAR cadastral', color: AGRO_COLOR, tooltip: `Total de ${kpis.total_imoveis_car.toLocaleString('pt-BR')} cadastros no SICAR/CAR. Cada linha = 1 código CAR distinto (coluna codigo_car: UNIQUE, 0 duplicatas). Não comprova unicidade física ou fundiária.` },
    { label: 'Geometrias Válidas', value: kpis.geometrias_validas > 0 ? fmt(kpis.geometrias_validas) : 'N/D', sub: 'Indisponível na base atual', color: '#94A3B8', tooltip: 'A tabela prospeccao.imovel_rural não possui coluna de geometria (PostGIS). Impossível calcular área geométrica ou dissolvida. Os pontos no mapa são coordenadas municipais de referência, não geometria de imóveis.' },
    { label: 'Área Declarada (SICAR)', value: fmtArea(kpis.area_declarada_ha), sub: 'Soma bruta, sujeita a sobreposições', color: '#3B82F6', tooltip: `Soma bruta de area_total_ha: ${kpis.area_declarada_ha.toLocaleString('pt-BR', {maximumFractionDigits:0})} ha. Valor declaratório do proprietário no CAR. Pode conter sobreposições entre cadastros. Não é área geoespacial, nem área sem sobreposição, nem área auditada geometricamente.` },
    { label: 'Municípios com CAR', value: `${kpis.municipios_com_registro_car}`, sub: `de ${kpis.municipios_ibge_total} mun. IBGE · ${kpis.ufs_presentes} UFs`, color: '#F59E0B', tooltip: `${kpis.municipios_com_registro_car} municípios com ao menos um registro CAR. ${kpis.municipios_ibge_total - kpis.municipios_com_registro_car} municípios sem qualquer registro.` },
    { label: 'CNPJs Relacionados', value: fmt(kpis.pessoas_juridicas_relacionadas), sub: 'Holdings/investidores c/ vínculo agro', color: '#8B5CF6', tooltip: `${kpis.pessoas_juridicas_relacionadas.toLocaleString('pt-BR')} CNPJs de holdings, investidores e imobiliárias com sócio em comum com empresas rurais. Fonte: RFB via prospeccao.holding_lead_ui.` },
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
        <header style={{ height: 'var(--topbar-h, 60px)', background: 'var(--bg-surface, #0F172A)', borderBottom: '1px solid var(--border-default, #1E293B)', display: 'flex', alignItems: 'center', padding: isMobile ? '0 12px' : '0 24px', gap: isMobile ? 8 : 16, position: 'sticky', top: 0, zIndex: 50 }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}><Menu size={20} /></button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', margin: 0 }}>Inteligência Territorial Rural</h1>
              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#22C55E', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={11} /> Dados Declaratórios CAR / Referência IBGE / Derivados RFB
              </span>
            </div>
            {!isMobile && kpis?.ultima_atualizacao && <p style={{ fontSize: 11, color: 'var(--text-tertiary, #64748B)', margin: 0, marginTop: 1 }}>Atualizado em {new Date(kpis.ultima_atualizacao).toLocaleDateString('pt-BR')}</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => navigate('/territorial')} style={{ height: 32, padding: '0 12px', fontSize: 11, fontWeight: 600, background: '#22C55E', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={13} /> {!isMobile && <span>Inteligência Territorial</span>}
            </button>
          </div>
        </header>

        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 8, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: isMobile ? '100%' : 220 }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar imóvel CAR, município..." style={{ width: '100%', height: 30, paddingLeft: 28, fontSize: 11, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4, color: 'var(--text-primary)' }} />
            </div>
            <BrazilUfSelect value={selectedUf} onChange={(val) => setSelectedUf(val)} showAllLabel="Todas as UFs" />
            {activeFiltersCount > 0 && (
              <button onClick={resetFilters} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <RotateCcw size={11} /> Limpar ({activeFiltersCount})
              </button>
            )}
          </div>

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12 }}>
              <div className="spinner" />
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Consultando base canônica do CAR...</p>
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12 }}>
              <AlertTriangle size={36} color="#EF4444" />
              <h3 style={{ color: '#EF4444', margin: 0 }}>Erro ao Carregar Dados do Agro</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{error}</p>
              <button onClick={loadAllData} style={{ height: 32, padding: '0 16px', fontSize: 12, fontWeight: 600, background: '#22C55E', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Tentar novamente</button>
            </div>
          )}

          {!loading && !error && kpis && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 12 }}>
                {kpiCards.map((kpi, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14 }} title={kpi.tooltip}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{kpi.label}</span>
                    <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color, margin: '2px 0' }}>{kpi.value}</div>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{kpi.sub}</span>
                  </div>
                ))}
              </div>

              {/* Módulos Agro 360° — Navegação Ativa */}
              <div style={{ background: "var(--bg-surface, #0F172A)", border: "1px solid var(--border-default, #1E293B)", borderRadius: 10, padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F8FAFC", marginBottom: 12 }}>Suíte Agro 360° — Módulos Disponíveis</h3>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
                  {navCards.map((card, idx) => (
                    <div
                      key={idx}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(card.route)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(card.route); } }}
                      aria-label={`Acessar módulo ${card.label}`}
                      style={{
                        background: "var(--bg-base, #090D16)",
                        border: "1px solid var(--border-default, #1E293B)",
                        borderRadius: 8,
                        padding: 16,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = card.color; e.currentTarget.style.boxShadow = `0 0 16px ${card.color}22`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-default, #1E293B)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: card.color, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {card.label}
                        {card.badge && (
                          <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            {card.badge}
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.4 }}>{card.desc}</span>
                      <span style={{ fontSize: 10, color: card.color, marginTop: 4, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                        Acessar módulo <ArrowRight size={12} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <BarChart2 size={16} color="#22C55E" />
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Distribuição — Dados Declaratórios do CAR</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Imóveis por Bioma (inferido pela UF do cadastro)</span>
                    {distBioma.map((cat, idx) => {
                      const pct = cat.percentual_imoveis || 0;
                      const colors = ['#F59E0B', '#22C55E', '#06B6D4', '#8B5CF6', '#EF4444', '#EC4899', '#94A3B8'];
                      return (
                        <div key={idx} onClick={() => setSelectedBioma(selectedBioma === cat.bioma ? '' : (cat.bioma || ''))} style={{ cursor: 'pointer', marginBottom: 6, opacity: cat.imoveis === 0 ? 0.5 : 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                            <span>{cat.bioma}</span>
                            <strong>{cat.imoveis ? fmt(cat.imoveis) : '0'} ({pct}%)</strong>
                          </div>
                          <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.max(pct, 1)}%`, height: '100%', background: colors[idx % colors.length], borderRadius: 3 }} />
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
                      Bioma inferido pela UF do cadastro (mapeamento IBGE UF→bioma dominante). Estados com mais de um bioma (MG, BA, etc.) são aproximações. Não substitui interseção geométrica do imóvel com bioma.
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Uso do solo declarado no CAR (ha)</span>
                    {distUsoSolo.map((cat, idx) => {
                      const pct = cat.percentual || 0;
                      const colors2 = ['#F59E0B', '#22C55E', '#06B6D4', '#94A3B8'];
                      return (
                        <div key={idx} style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                            <span>{cat.classe}</span>
                            <strong>{fmtArea(cat.area_ha || 0)} ({pct}%)</strong>
                          </div>
                          <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.max(pct, 1)}%`, height: '100%', background: colors2[idx % colors2.length], borderRadius: 3 }} />
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
                      Uso do solo declarado no CAR pelos proprietários (area_pasto_ha, area_lavoura_ha, area_vegetacao_nativa_ha). Dado declaratório, sem validação por sensoriamento remoto. O denominador de 538,6M ha difere da área total (719,4M ha) porque 26.204 registros (0,3%) não informam o desdobramento por classe.
                    </div>
                  </div>
                </div>
              </div>

              {/* Componente do Mapa Agro com Estado Isolado e Proveniência Exclusiva do Endpoint /agro/mapa */}
              <AgroTerritorialMap
                rawClusters={mapaClusters}
                totalNoRecorte={mapaTotal}
                loading={mapLoading}
                error={mapError}
                onRetry={fetchMapaData}
                sources={mapResponse?.fontes}
                sourceDate={mapResponse?.ultima_atualizacao}
                loadedAt={mapResponse?.data_carga}
                consolidatedAt={mapResponse?.data_consolidacao}
              />

              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Target size={16} color="#F59E0B" />
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Oportunidades e Relações Cross-Domain</h3>
                </div>
                {oportunidadesMsg ? (
                  <div style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {oportunidadesMsg}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                    {oportunidades.slice(0, 5).map((opp, idx) => (
                      <div key={idx} style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{opp.titulo || opp.tipo_relacao}</strong>
                          <span style={{ color: opp.classificacao === 'CONFIRMADO' ? '#22C55E' : '#06B6D4', fontWeight: 700 }}>
                            {opp.classificacao} ({Math.round(opp.score || 0)}%)
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: 2, fontSize: 10 }}>{opp.descricao || opp.evidencia}</div>
                        {opp.limitacoes && <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{opp.limitacoes}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {relacoesMsg ? (
                  <div style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
                    {relacoesMsg}
                  </div>
                ) : relacoes.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Relações Cross-Domain Materializadas</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                      {relacoes.slice(0, 5).map((rel, idx) => (
                        <div key={idx} style={{ padding: 10, background: 'var(--bg-base)', borderRadius: 6, border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>{rel.source_type} → {rel.target_type}</strong>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{rel.tipo_relacao} · {rel.evidencia}</div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, color: rel.classificacao === 'CONFIRMADO' ? '#22C55E' : rel.classificacao === 'PROVÁVEL' ? '#06B6D4' : '#F59E0B', background: rel.classificacao === 'CONFIRMADO' ? 'rgba(34,197,94,0.15)' : rel.classificacao === 'PROVÁVEL' ? 'rgba(6,182,212,0.15)' : 'rgba(245,158,11,0.15)' }}>
                            {rel.classificacao} ({Math.round(rel.score || 0)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border-default, #1E293B)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 10, color: 'var(--text-tertiary)' }}>
                <div>
                  <strong>Qualidade e Proveniência:</strong> {fmt(kpis.total_imoveis_car)} cadastros CAR únicos · {fmt(kpis.municipios_com_registro_car)} municípios · {kpis.ufs_presentes} UFs.
                  <div style={{ marginTop: 2 }}>Fontes: {kpis.fontes.join(', ')}</div>
                  <div style={{ fontSize: 9, marginTop: 1 }}>{kpis.classificacao}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
