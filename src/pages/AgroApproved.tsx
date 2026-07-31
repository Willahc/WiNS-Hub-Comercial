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
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  const [oportunidades, setOportunidades] = useState<any[]>([]);
  const [relacoes, setRelacoes] = useState<any[]>([]);
  const [oportunidadesMsg, setOportunidadesMsg] = useState<string | null>(null);
  const [relacoesMsg, setRelacoesMsg] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const ufFromUrl = searchParams.get('uf') || '';
  const [selectedUf, setSelectedUf] = useState(ufFromUrl);
  const [selectedBioma, setSelectedBioma] = useState('');
  const [selectedUso, setSelectedUso] = useState('');

  const abortRef = useRef<AbortController | null>(null);

  const activeFiltersCount = [searchQuery, selectedUf, selectedBioma, selectedUso].filter(Boolean).length;

  const fetchMapaData = useCallback(async () => {
    setMapLoading(true);
    setMapError(null);
    try {
      const params: Record<string, string> = {};
      if (selectedUf) params.uf = selectedUf;
      const res = await httpClient.get(AGRO_API.mapa, { params, signal: abortRef.current?.signal });
      if (res && res.data) {
        setMapaClusters(res.data.clusters || []);
        setMapaTotal(res.data.total_no_recorte || 0);
        setMapError(null);
      } else {
        setMapaClusters([]);
        setMapaTotal(0);
        setMapError('Não foi possível carregar o mapa territorial.');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setMapaClusters([]);
      setMapaTotal(0);
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
        setMapaClusters(mapaResult.value.data.clusters || []);
        setMapaTotal(mapaResult.value.data.total_no_recorte || 0);
        setMapError(null);
      } else {
        setMapaClusters([]);
        setMapaTotal(0);
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
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [loadAllData]);

  useEffect(() => {
    const p: Record<string, string> = {};
    if (selectedUf) p.uf = selectedUf;
    setSearchParams(p, { replace: true });
  }, [selectedUf, setSearchParams]);

  const clearAllFilters = () => {
    setSelectedUf('');
    setSelectedBioma('');
    setSelectedUso('');
    setSearchQuery('');
  };

  return (
    <div className="wins-layout" style={{ background: 'var(--bg-base, #030712)', minHeight: '100vh', color: 'var(--text-primary, #F8FAFC)' }}>
      {isMobile ? (
        <MobileSidebarContent onCloseMobile={() => setSidebarOpen(false)} />
      ) : (
        <DesktopSidebar />
      )}

      <div className="wins-main" style={{ marginLeft: isMobile ? 0 : 240, transition: 'margin 0.2s', padding: isMobile ? 12 : 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                <span>WiNS Hub</span>
                <ChevronRight size={12} />
                <span>Verticais</span>
                <ChevronRight size={12} />
                <span style={{ color: AGRO_COLOR, fontWeight: 600 }}>Agro</span>
              </div>
              <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sprout color={AGRO_COLOR} size={isMobile ? 22 : 26} />
                Vertical Agro — Produção e Regularidade CAR
              </h1>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/agro/propriedades')} className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}>
                Catalogar Imóveis
              </button>
              <button onClick={() => navigate('/agro/leads')} className="btn-primary" style={{ background: AGRO_COLOR, fontSize: 12, padding: '6px 12px' }}>
                Explorar Leads
              </button>
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ minWidth: 140 }}>
              <BrazilUfSelect value={selectedUf} onChange={setSelectedUf} showAllLabel="Todas as UFs" />
            </div>

            {activeFiltersCount > 0 && (
              <button onClick={clearAllFilters} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#EF4444', fontSize: 11, cursor: 'pointer', padding: '4px 8px' }}>
                <X size={12} /> Limpar ({activeFiltersCount})
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <RefreshCw className="animate-spin" size={24} style={{ marginBottom: 12, color: AGRO_COLOR }} />
              <div>Carregando indicadores do Agro...</div>
            </div>
          ) : error ? (
            <div style={{ padding: 20, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: 8, color: '#EF4444' }}>
              <AlertTriangle size={20} style={{ marginBottom: 8 }} />
              <div>{error}</div>
              <button onClick={loadAllData} style={{ marginTop: 12, padding: '6px 12px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                Tentar Novamente
              </button>
            </div>
          ) : kpis && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12 }}>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Total de Cadastros CAR</div>
                  <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: AGRO_COLOR }}>{fmt(kpis.total_imoveis_car)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>{fmt(kpis.codigos_car_unicos)} códigos únicos</div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Área Declarada Total</div>
                  <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#38BDF8' }}>{fmtArea(kpis.area_declarada_ha)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>Pasto: {fmtArea(kpis.area_pasto_ha)}</div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Cobertura Municipal IBGE</div>
                  <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#F59E0B' }}>{fmt(kpis.municipios_com_registro_car)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>de {fmt(kpis.municipios_ibge_total)} municípios ({kpis.ufs_presentes} UFs)</div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Pessoas Jurídicas Viculadas</div>
                  <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#A855F7' }}>{fmt(kpis.pessoas_juridicas_relacionadas)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>CNPJs cruzados no SICAR</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BarChart2 size={16} color={AGRO_COLOR} />
                    Distribuição por Bioma Declarado
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {distBioma.map((cat, idx) => {
                      const pct = cat.percentual || 0;
                      const colors = ['#22C55E', '#38BDF8', '#F59E0B', '#A855F7', '#EC4899', '#64748B'];
                      return (
                        <div key={idx} style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                            <span>{cat.bioma}</span>
                            <strong>{fmt(cat.imoveis || 0)} ({pct}%)</strong>
                          </div>
                          <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.max(pct, 1)}%`, height: '100%', background: colors[idx % colors.length], borderRadius: 3 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BarChart2 size={16} color="#38BDF8" />
                    Distribuição por Uso do Solo Declarado
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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

              {/* Componente do Mapa Agro com Estado Isolado */}
              <AgroTerritorialMap
                rawClusters={mapaClusters}
                totalNoRecorte={mapaTotal}
                loading={mapLoading}
                error={mapError}
                onRetry={fetchMapaData}
                sources={kpis.fontes}
                sourceDate={kpis.ultima_atualizacao}
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
