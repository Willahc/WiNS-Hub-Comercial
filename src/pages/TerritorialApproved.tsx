import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MapPin, Search, RotateCcw, Menu, ShieldCheck, Layers, Building2,
  Truck, Sprout, HeartPulse, HardHat, TrendingUp, AlertTriangle,
  CheckCircle2, ChevronRight, Info, ExternalLink, Download, Share2,
  RefreshCw, Maximize2, Sparkles, Filter, Database, ArrowRight, Eye,
  Sliders, Compass, HelpCircle, Scale, X
} from 'lucide-react';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { TerritorialMapVisualizer } from '../components/TerritorialMapVisualizer';
import { exportService } from '../services/exportService';
import {
  MASTER_MUNICIPALITIES,
  MASTER_TERRITORIAL_MARKERS,
  type MunicipalityProfile,
  type TerritorialMarker
} from '../services/territorialDatabase';

const BRAZIL_CENTER: [number, number] = [-14.235, -51.925];

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

const fmtCurrency = (v: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
};

export default function TerritorialApproved() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 767px)');
  
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // URL search params state
  const ibgeParam = searchParams.get('ibge') || searchParams.get('municipality_ibge') || '4106902';
  const verticalParam = searchParams.get('vertical') || 'todas';
  const munParam = searchParams.get('municipality') || 'Curitiba';
  const ufParam = searchParams.get('uf') || '';
  const scopeParam = (searchParams.get('scope') || 'brasil') as 'brasil' | 'uf' | 'municipio' | '15km';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIbge, setSelectedIbge] = useState(ibgeParam);
  const [selectedVertical, setSelectedVertical] = useState(verticalParam);
  const [radiusScope, setRadiusScope] = useState<'brasil' | 'uf' | 'municipio' | '15km'>(scopeParam);
  const [selectedLayerTypes, setSelectedLayerTypes] = useState<string[]>([
    'obra', 'empresa', 'transportador', 'imovel_car', 'estabelecimento_cnes', 'oportunidade', 'evento'
  ]);

  const [compareMunIbge, setCompareMunIbge] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<TerritorialMarker | null>(null);
  const [activeKpiModal, setActiveKpiModal] = useState<string | null>(null);

  // Selected Municipality Profile
  const currentMun: MunicipalityProfile = useMemo(() => {
    return MASTER_MUNICIPALITIES.find(m => m.ibge === selectedIbge) || MASTER_MUNICIPALITIES[0];
  }, [selectedIbge]);

  const mapCenter = radiusScope === 'brasil' ? BRAZIL_CENTER : [currentMun.lat, currentMun.lng] as [number, number];
  const mapZoom = radiusScope === 'brasil' ? 4.5 : 11;

  const compareMun: MunicipalityProfile | undefined = useMemo(() => {
    if (!compareMunIbge) return undefined;
    return MASTER_MUNICIPALITIES.find(m => m.ibge === compareMunIbge);
  }, [compareMunIbge]);

  // Filtered Markers for Map Visualizer
  const currentMarkers: TerritorialMarker[] = useMemo(() => {
    return MASTER_TERRITORIAL_MARKERS.filter(m => {
      if (radiusScope === 'municipio' || radiusScope === '15km') {
        if (m.ibge !== currentMun.ibge) return false;
      } else if (radiusScope === 'uf') {
        if (m.uf !== currentMun.uf) return false;
      }
      if (selectedVertical !== 'todas' && m.vertical.toLowerCase() !== selectedVertical) return false;
      return true;
    });
  }, [currentMun, radiusScope, selectedVertical]);

  // Autocomplete search suggestions
  const autocompleteSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return MASTER_MUNICIPALITIES.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.uf.toLowerCase().includes(q) ||
      m.ibge.includes(q)
    );
  }, [searchQuery]);

  // Update URL Search Params
  const updateUrlParams = (newParams: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    setSearchParams(params);
  };

  const handleSelectMunicipality = (m: MunicipalityProfile) => {
    setSelectedIbge(m.ibge);
    setSearchQuery('');
    updateUrlParams({ ibge: m.ibge, municipality: m.name, uf: m.uf });
  };

  const toggleLayer = (layer: string) => {
    setSelectedLayerTypes(prev =>
      prev.includes(layer) ? prev.filter(l => l !== layer) : [...prev, layer]
    );
  };

  return (
    <div data-ui-version="territorial-approved-v2" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #090D16)', position: 'relative', overflow: 'hidden' }}>
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
        {/* Topbar */}
        <header style={{
          height: 'var(--topbar-h, 60px)', background: 'var(--bg-surface, #0F172A)',
          borderBottom: '1px solid var(--border-default, #1E293B)', display: 'flex', alignItems: 'center',
          padding: isMobile ? '0 12px' : '0 24px', gap: 16, position: 'sticky', top: 0, zIndex: 50,
        }}>
          {isMobile && (
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
              <Menu size={20} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', margin: 0 }}>
              Inteligência Territorial
            </h1>
            {!isMobile && <p style={{ fontSize: 11, color: 'var(--text-tertiary, #64748B)', margin: 0, marginTop: 1 }}>Visão integrada de empresas, infraestrutura e oportunidades por território</p>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => exportService.printDossierReport({ type: 'municipio', title: `Visao Territorial ${currentMun.name}/${currentMun.uf}`, generatedAt: '24/07/2026' })}
              style={{ height: 30, padding: '0 10px', fontSize: 11, fontWeight: 600, background: '#06B6D4', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Download size={12} /> {!isMobile && <span>Exportar Visão</span>}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#F59E0B', fontWeight: 600, background: 'rgba(245,158,11,0.1)', padding: '4px 8px', borderRadius: 4 }}>
              <ShieldCheck size={14} /><span>Dados Oficiais IBGE 2026</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* SECTION 1: SELETOR TERRITORIAL & CABEÇALHO DE RECORTE */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={18} color="#06B6D4" />
                <div>
                  <span style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Recorte Territorial Atual:</span>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#FFF' }}>
                    {currentMun.name}/{currentMun.uf} <span style={{ fontSize: 11, color: '#06B6D4', fontWeight: 600 }}>(Código IBGE: {currentMun.ibge})</span> · {radiusScope.toUpperCase()} · 4 Verticais Integradas
                  </div>
                </div>
              </div>

              {/* Escopo de Raio */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>Escopo:</span>
                {(['15km', 'municipio', 'uf', 'brasil'] as const).map(scope => (
                  <button
                    key={scope}
                    onClick={() => { setRadiusScope(scope); updateUrlParams({ scope }); }}
                    style={{
                      height: 26, padding: '0 10px', fontSize: 10, fontWeight: 700, borderRadius: 4, cursor: 'pointer',
                      background: radiusScope === scope ? '#06B6D4' : '#1E293B',
                      color: radiusScope === scope ? '#FFF' : '#94A3B8',
                      border: '1px solid #334155'
                    }}
                  >
                    {scope === '15km' ? 'Raio 15km' : scope.toUpperCase()}
                  </button>
                ))}
              </div>

              <BrazilUfSelect
                value={currentMun.uf}
                onChange={(val) => {
                  setRadiusScope(val ? 'uf' : 'brasil');
                  updateUrlParams({ uf: val || undefined, scope: val ? 'uf' : 'BR' });
                }}
                showAllLabel="Brasil (27 UFs)"
                style={{ height: 26 }}
              />
            </div>

            {/* Autocomplete Input Search */}
            <div style={{ position: 'relative', width: '100%' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  data-testid="territorial-autocomplete-input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por município, código IBGE, UF ou entidade (ex: Curitiba, Araucária, 4106902)..."
                  style={{
                    width: '100%', height: 36, paddingLeft: 36, paddingRight: 12, fontSize: 11,
                    background: '#090D16', border: '1px solid #334155', borderRadius: 6, color: '#FFF'
                  }}
                />
              </div>

              {/* Autocomplete Dropdown */}
              {autocompleteSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: 40, left: 0, right: 0, background: '#0F172A',
                  border: '1px solid #06B6D4', borderRadius: 6, zIndex: 100, maxHeight: 220, overflowY: 'auto',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                }}>
                  {autocompleteSuggestions.map(m => (
                    <div
                      key={m.ibge}
                      data-testid={`suggestion-${m.ibge}`}
                      onClick={() => handleSelectMunicipality(m)}
                      style={{ padding: '10px 14px', borderBottom: '1px solid #1E293B', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(6,182,212,0.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <strong style={{ color: '#FFF', fontSize: 12 }}>{m.name}/{m.uf}</strong>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>IBGE: {m.ibge} · {m.region}</div>
                      </div>
                      <span style={{ fontSize: 10, color: '#06B6D4', fontWeight: 700 }}>
                        {m.engenharia.visibleWorksCount} obras · {m.logistica.uniqueCarriersCount} transp.
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: KPIS DAS 4 VERTICAIS (SEPARANDO UNIVERSOS FÍSICOS VS RECORTE) */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 12 }}>
            
            {/* CARD ENGENHARIA */}
            <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid #3B82F6', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#3B82F6', fontWeight: 700, fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><HardHat size={16} /> Engenharia</span>
                <Info size={13} style={{ cursor: 'pointer' }} onClick={() => setActiveKpiModal('engenharia')} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#FFF', marginTop: 8 }}>
                {currentMun.engenharia.visibleWorksCount} obras no recorte
              </div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                Catálogo Físico Nac.: <strong>{currentMun.engenharia.physicalCatalogCount.toLocaleString('pt-BR')}</strong>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', marginTop: 6 }}>
                CAPEX Homologado: {fmtCurrency(currentMun.engenharia.capexHomologated)}
              </div>
              <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 4 }}>
                {currentMun.engenharia.executingCompaniesCount} empresas executoras · {currentMun.engenharia.qualifiedOpportunitiesCount} oportunidades
              </div>
            </div>

            {/* CARD AGRO */}
            <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid #22C55E', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#22C55E', fontWeight: 700, fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Sprout size={16} /> Agronegócio</span>
                <Info size={13} style={{ cursor: 'pointer' }} onClick={() => setActiveKpiModal('agro')} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#FFF', marginTop: 8 }}>
                {currentMun.agro.uniqueCarPropertiesCount} imóveis CAR únicos
              </div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                Registros Físicos Nac.: <strong>{currentMun.agro.physicalRecordsCount.toLocaleString('pt-BR')}</strong>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', marginTop: 6 }}>
                Área Mapeada: {currentMun.agro.totalAreaHa.toLocaleString('pt-BR')} ha
              </div>
              <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 4 }}>
                {currentMun.agro.validGeometryCount} geometrias válidas · {currentMun.agro.agroCompaniesCount} empresas
              </div>
            </div>

            {/* CARD LOGÍSTICA */}
            <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid #06B6D4', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#06B6D4', fontWeight: 700, fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Truck size={16} /> Logística & Frota</span>
                <Info size={13} style={{ cursor: 'pointer' }} onClick={() => setActiveKpiModal('logistica')} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#FFF', marginTop: 8 }}>
                {currentMun.logistica.uniqueCarriersCount.toLocaleString('pt-BR')} transportadores únicos
              </div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                RNTRCs Ativos Nac.: <strong>{currentMun.logistica.activeRntrcsCount.toLocaleString('pt-BR')}</strong>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#06B6D4', marginTop: 6 }}>
                Frota Cadastrada: {currentMun.logistica.registeredFleetCount.toLocaleString('pt-BR')} veículos
              </div>
              <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 4 }}>
                {currentMun.logistica.carrierCompaniesCount} empresas (ETC) · {currentMun.logistica.autonomousDriversCount} autônomos (TAC)
              </div>
            </div>

            {/* CARD SAÚDE */}
            <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid #EC4899', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#EC4899', fontWeight: 700, fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><HeartPulse size={16} /> Saúde & CNES</span>
                <Info size={13} style={{ cursor: 'pointer' }} onClick={() => setActiveKpiModal('saude')} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#FFF', marginTop: 8 }}>
                {currentMun.saude.uniqueFacilitiesCount.toLocaleString('pt-BR')} estabelecimentos únicos
              </div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                Cadastros Ativos Nac.: <strong>{currentMun.saude.activeFacilitiesCount.toLocaleString('pt-BR')}</strong>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#EC4899', marginTop: 6 }}>
                Total de Leitos: {currentMun.saude.totalBedsCount.toLocaleString('pt-BR')} ({currentMun.saude.utiBedsCount} UTI)
              </div>
              <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 4 }}>
                {currentMun.saude.hospitalsCount} hospitais · {currentMun.saude.mantenedorasCount} mantenedoras
              </div>
            </div>

          </div>

          {/* SECTION 3: MAPA TERRITORIAL INTEGRADO COM LAYERS SELECIONÁVEIS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Camadas Checkbox Toolbar */}
            <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 11 }}>
              <span style={{ fontWeight: 700, color: '#FFF', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Layers size={14} color="#06B6D4" /> Camadas no Mapa:
              </span>
              {[
                { id: 'obra', label: 'Obras (Engenharia)', color: '#3B82F6' },
                { id: 'empresa', label: 'Empresas (QSA)', color: '#8B5CF6' },
                { id: 'transportador', label: 'Transportadores (RNTRC)', color: '#06B6D4' },
                { id: 'imovel_car', label: 'Imóveis CAR (Agro)', color: '#22C55E' },
                { id: 'estabelecimento_cnes', label: 'Saúde (CNES)', color: '#EC4899' },
                { id: 'oportunidade', label: 'Oportunidades', color: '#10B981' },
                { id: 'evento', label: 'Eventos', color: '#EF4444' }
              ].map(layer => (
                <label key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: selectedLayerTypes.includes(layer.id) ? layer.color : '#64748B', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={selectedLayerTypes.includes(layer.id)}
                    onChange={() => toggleLayer(layer.id)}
                  />
                  <span>{layer.label}</span>
                </label>
              ))}
            </div>

            {/* Visualizador de Mapa Leaflet */}
            <TerritorialMapVisualizer
              markers={currentMarkers}
              centerLat={mapCenter[0]}
              centerLng={mapCenter[1]}
              zoomLevel={mapZoom}
              activeLayers={selectedLayerTypes}
              viewMode="pontos"
              onSelectMarker={(m) => setSelectedMarker(m)}
              onSelectMunicipality={(ibge) => setSelectedIbge(ibge)}
            />
          </div>

          {/* SECTION 4: PAINEL DO TERRITÓRIO SELECIONADO & ALERTA DE VÍNCULO */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Compass size={16} color="#06B6D4" /> Perfil Executivo Territorial: {currentMun.name}/{currentMun.uf}
              </h3>
              <span style={{ fontSize: 10, color: '#94A3B8' }}>População: {currentMun.population2026} · Área: {currentMun.areaKm2} km²</span>
            </div>

            {/* Obligatory Classification Notice */}
            <div style={{ padding: '8px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid #F59E0B', borderRadius: 6, color: '#F59E0B', fontSize: 10, fontWeight: 600 }}>
              ⚠️ Coincidências territoriais são classificadas como POTENCIAIS e não representam vínculo comercial ou operacional sem prova documental auditada.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, fontSize: 11 }}>
              <div style={{ background: '#090D16', padding: 12, borderRadius: 8, border: '1px solid #1E293B' }}>
                <strong style={{ color: '#FFF' }}>Identificação Territorial:</strong>
                <div style={{ color: '#94A3B8', marginTop: 4 }}>Código IBGE: <strong>{currentMun.ibge}</strong></div>
                <div style={{ color: '#94A3B8' }}>Região: <strong>{currentMun.region}</strong></div>
                <div style={{ color: '#94A3B8' }}>Vizinhos: {currentMun.neighboringMun.join(', ')}</div>
              </div>

              <div style={{ background: '#090D16', padding: 12, borderRadius: 8, border: '1px solid #1E293B' }}>
                <strong style={{ color: '#FFF' }}>Cobertura das 4 Verticais:</strong>
                <div style={{ color: '#3B82F6', marginTop: 4 }}>Engenharia: {currentMun.engenharia.visibleWorksCount} obras</div>
                <div style={{ color: '#22C55E' }}>Agro: {currentMun.agro.uniqueCarPropertiesCount} imóveis CAR</div>
                <div style={{ color: '#06B6D4' }}>Logística: {currentMun.logistica.uniqueCarriersCount} transportadores</div>
                <div style={{ color: '#EC4899' }}>Saúde: {currentMun.saude.uniqueFacilitiesCount} estabelecimentos CNES</div>
              </div>

              <div style={{ background: '#090D16', padding: 12, borderRadius: 8, border: '1px solid #1E293B' }}>
                <strong style={{ color: '#FFF' }}>Qualidade & Auditoria:</strong>
                <div style={{ color: '#22C55E', marginTop: 4 }}>Cobertura Auditada: {currentMun.qualityProvenance.coveragePct}%</div>
                <div style={{ color: '#94A3B8' }}>Versão Algoritmo: {currentMun.qualityProvenance.algorithmVersion}</div>
                <div style={{ color: '#94A3B8' }}>Geocodificação Aproximada: {currentMun.qualityProvenance.approxGeocodingCount} registros</div>
              </div>
            </div>
          </div>

          {/* SECTION 5: MATRIZ COMPARATIVA DAS 4 VERTICAIS */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={16} color="#8B5CF6" /> Matriz Comparativa Multivertical do Território
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>Vertical</th>
                    <th style={{ padding: 8 }}>Presença no Território</th>
                    <th style={{ padding: 8 }}>Principais Entidades</th>
                    <th style={{ padding: 8 }}>Cobertura %</th>
                    <th style={{ padding: 8 }}>Qualidade Cadastral</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: 8, fontWeight: 700, color: '#3B82F6' }}>Engenharia</td>
                    <td style={{ padding: 8, color: '#FFF' }}>{currentMun.engenharia.visibleWorksCount} obras ativas ({fmtCurrency(currentMun.engenharia.capexHomologated)})</td>
                    <td style={{ padding: 8, color: '#94A3B8' }}>Alvarás, licitações PNCP, empreiteiras</td>
                    <td style={{ padding: 8, color: '#22C55E', fontWeight: 700 }}>98.4%</td>
                    <td style={{ padding: 8, color: '#FFF' }}>Completude Contratual 1:1</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: 8, fontWeight: 700, color: '#22C55E' }}>Agronegócio</td>
                    <td style={{ padding: 8, color: '#FFF' }}>{currentMun.agro.uniqueCarPropertiesCount} imóveis CAR ({currentMun.agro.totalAreaHa} ha)</td>
                    <td style={{ padding: 8, color: '#94A3B8' }}>Glebas SICAR, pastagem, agricultura</td>
                    <td style={{ padding: 8, color: '#22C55E', fontWeight: 700 }}>97.2%</td>
                    <td style={{ padding: 8, color: '#FFF' }}>Geometria Válida MMA</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: 8, fontWeight: 700, color: '#06B6D4' }}>Logística</td>
                    <td style={{ padding: 8, color: '#FFF' }}>{currentMun.logistica.uniqueCarriersCount} transportadores ({currentMun.logistica.registeredFleetCount} veículos)</td>
                    <td style={{ padding: 8, color: '#94A3B8' }}>RNTRC ANTT, empresas ETC, autônomos TAC</td>
                    <td style={{ padding: 8, color: '#22C55E', fontWeight: 700 }}>96.8%</td>
                    <td style={{ padding: 8, color: '#FFF' }}>Ativos Validados ANTT</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: 8, fontWeight: 700, color: '#EC4899' }}>Saúde</td>
                    <td style={{ padding: 8, color: '#FFF' }}>{currentMun.saude.uniqueFacilitiesCount} unidades CNES ({currentMun.saude.totalBedsCount} leitos)</td>
                    <td style={{ padding: 8, color: '#94A3B8' }}>Hospitais, UPA 24H, clínicas DATASUS</td>
                    <td style={{ padding: 8, color: '#22C55E', fontWeight: 700 }}>96.5%</td>
                    <td style={{ padding: 8, color: '#FFF' }}>Ativos CNES Ministério da Saúde</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 6: OPORTUNIDADES TERRITORIAIS EXPLICÁVEIS */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={16} color="#10B981" /> Oportunidades Territoriais Explicáveis
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentMun.highlightOpportunities.map(op => (
                <div key={op.id} style={{ background: '#090D16', border: '1px solid #10B981', borderRadius: 8, padding: 12, fontSize: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#FFF', fontSize: 12 }}>{op.title}</strong>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                      Score {op.score}/100 · PROVÁVEL
                    </span>
                  </div>
                  <div style={{ color: '#CBD5E1', marginTop: 4 }}><strong>Racional:</strong> {op.rationale}</div>
                  <div style={{ color: '#94A3B8', fontSize: 10, marginTop: 4 }}>Território: {currentMun.name}/{currentMun.uf} · Fonte: WiNS Engine Auditada</div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 8: RELAÇÕES CROSS-DOMAIN NO TERRITÓRIO */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Share2 size={16} color="#8B5CF6" /> Matriz de Relações Cross-Domain no Território
              </h3>
              <button
                onClick={() => navigate(`/relacionamentos?mun=${encodeURIComponent(currentMun.name)}`)}
                style={{ height: 28, padding: '0 10px', fontSize: 10, fontWeight: 700, background: '#8B5CF6', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                Investigar em Relacionamentos <ArrowRight size={12} />
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8' }}>
                    <th style={{ padding: 6 }}>Entidade A</th>
                    <th style={{ padding: 6 }}>Relação Cross-Domain</th>
                    <th style={{ padding: 6 }}>Entidade B</th>
                    <th style={{ padding: 6 }}>Classificação</th>
                    <th style={{ padding: 6 }}>Confiança</th>
                    <th style={{ padding: 6 }}>Evidência Auditada</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: 6, fontWeight: 600, color: '#FFF' }}>LUMINA GESTAO DE OBRAS</td>
                    <td style={{ padding: 6, color: '#3B82F6' }}>Executora ↔ Obra Viária</td>
                    <td style={{ padding: 6, color: '#FFF' }}>Alvará Curitiba - Pavimentação</td>
                    <td style={{ padding: 6 }}><span style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: 9 }}>CONFIRMADO</span></td>
                    <td style={{ padding: 6, color: '#22C55E', fontWeight: 700 }}>98%</td>
                    <td style={{ padding: 6, color: '#94A3B8', fontSize: 10 }}>Termo de homologação PNCP 049/2026</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #1E293B' }}>
                    <td style={{ padding: 6, fontWeight: 600, color: '#FFF' }}>LOGISTICA CORREDOR SUL</td>
                    <td style={{ padding: 6, color: '#06B6D4' }}>Suporte Logístico ↔ Obra</td>
                    <td style={{ padding: 6, color: '#FFF' }}>Duplicação Contorno Leste</td>
                    <td style={{ padding: 6 }}><span style={{ background: 'rgba(6,182,212,0.15)', color: '#06B6D4', padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: 9 }}>PROVÁVEL</span></td>
                    <td style={{ padding: 6, color: '#06B6D4', fontWeight: 700 }}>91%</td>
                    <td style={{ padding: 6, color: '#94A3B8', fontSize: 10 }}>Match CNAE 49.30-2 e geofence &lt; 5km</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 9: COMPARAÇÃO TERRITORIAL */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Scale size={16} color="#F59E0B" /> Comparativo de Territórios (Benchmarking)
              </h3>
              <select
                value={compareMunIbge || ''}
                onChange={e => setCompareMunIbge(e.target.value || null)}
                style={{ height: 28, background: '#090D16', border: '1px solid #334155', color: '#FFF', fontSize: 11, borderRadius: 4, padding: '0 8px' }}
              >
                <option value="">Comparar com outro município...</option>
                {MASTER_MUNICIPALITIES.filter(m => m.ibge !== currentMun.ibge).map(m => (
                  <option key={m.ibge} value={m.ibge}>{m.name}/{m.uf} (IBGE: {m.ibge})</option>
                ))}
              </select>
            </div>

            {compareMun ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1E293B', color: '#94A3B8' }}>
                      <th style={{ padding: 6 }}>Indicador Territorial</th>
                      <th style={{ padding: 6, color: '#06B6D4' }}>{currentMun.name}/{currentMun.uf}</th>
                      <th style={{ padding: 6, color: '#F59E0B' }}>{compareMun.name}/{compareMun.uf}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: 6, fontWeight: 600, color: '#FFF' }}>Obras Ativas (Engenharia)</td>
                      <td style={{ padding: 6, color: '#FFF', fontWeight: 700 }}>{currentMun.engenharia.visibleWorksCount} obras</td>
                      <td style={{ padding: 6, color: '#FFF', fontWeight: 700 }}>{compareMun.engenharia.visibleWorksCount} obras</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: 6, fontWeight: 600, color: '#FFF' }}>CAPEX Homologado</td>
                      <td style={{ padding: 6, color: '#22C55E', fontWeight: 700 }}>{fmtCurrency(currentMun.engenharia.capexHomologated)}</td>
                      <td style={{ padding: 6, color: '#22C55E', fontWeight: 700 }}>{fmtCurrency(compareMun.engenharia.capexHomologated)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: 6, fontWeight: 600, color: '#FFF' }}>Imóveis CAR (Agro)</td>
                      <td style={{ padding: 6, color: '#FFF' }}>{currentMun.agro.uniqueCarPropertiesCount} ({currentMun.agro.totalAreaHa} ha)</td>
                      <td style={{ padding: 6, color: '#FFF' }}>{compareMun.agro.uniqueCarPropertiesCount} ({compareMun.agro.totalAreaHa} ha)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: 6, fontWeight: 600, color: '#FFF' }}>Transportadores (Logística)</td>
                      <td style={{ padding: 6, color: '#FFF' }}>{currentMun.logistica.uniqueCarriersCount} ({currentMun.logistica.registeredFleetCount} veículos)</td>
                      <td style={{ padding: 6, color: '#FFF' }}>{compareMun.logistica.uniqueCarriersCount} ({compareMun.logistica.registeredFleetCount} veículos)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1E293B' }}>
                      <td style={{ padding: 6, fontWeight: 600, color: '#FFF' }}>Unidades CNES (Saúde)</td>
                      <td style={{ padding: 6, color: '#FFF' }}>{currentMun.saude.uniqueFacilitiesCount} ({currentMun.saude.totalBedsCount} leitos)</td>
                      <td style={{ padding: 6, color: '#FFF' }}>{compareMun.saude.uniqueFacilitiesCount} ({compareMun.saude.totalBedsCount} leitos)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#94A3B8' }}>Selecione um segundo município acima para habilitar o painel comparativo.</div>
            )}
          </div>

          {/* SECTION 10 & 11: INSIGHTS TERRITORIAIS EXPLICÁVEIS */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} color="#F59E0B" /> Insights Territoriais Automáticos
            </h3>
            {currentMun.insights.map((ins, i) => (
              <div key={i} style={{ background: '#090D16', border: '1px solid #F59E0B', borderRadius: 8, padding: 12, fontSize: 11 }}>
                <strong style={{ color: '#F59E0B', fontSize: 12 }}>{ins.title}</strong>
                <div style={{ color: '#FFF', marginTop: 4 }}><strong>Racional:</strong> {ins.rationale}</div>
                <div style={{ color: '#94A3B8', fontSize: 10, marginTop: 4 }}>
                  Evidência: {ins.evidence} · Confiança: <strong>{ins.confidence}%</strong> · Fonte: {ins.source} · Ação Sugerida: <strong>{ins.suggestedAction}</strong>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* KPI EXPLANATION MODAL */}
      {activeKpiModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0F172A', border: '1px solid #06B6D4', borderRadius: 10, padding: 20, maxWidth: 500, width: '90%', color: '#FFF', fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', paddingBottom: 10, marginBottom: 12 }}>
              <h3 style={{ margin: 0, textTransform: 'capitalize', color: '#06B6D4' }}>Definição do Indicador: {activeKpiModal}</h3>
              <X size={16} style={{ cursor: 'pointer' }} onClick={() => setActiveKpiModal(null)} />
            </div>
            <p><strong>Definição:</strong> Métrica agregada derivada de dados oficiais por município/UF.</p>
            <p><strong>Fontes Utilizadas:</strong> PNCP, Receita Federal RFB, ANTT RNTRC, SICAR MMA, DATASUS CNES, IBGE 2026.</p>
            <p><strong>Universo da Base:</strong> Distinção explícita entre catálogo físico nacional vs registros visíveis filtrados por geofence.</p>
            <p><strong>Limitações:</strong> Geocodificação de alguns imóveis rurais e pontes viárias sujeita a refinamento topográfico.</p>
            <button onClick={() => setActiveKpiModal(null)} style={{ padding: '6px 14px', background: '#06B6D4', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
