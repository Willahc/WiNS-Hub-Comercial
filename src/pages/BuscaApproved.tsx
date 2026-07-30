import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, MapPin, Building2, Truck, Sprout, HeartPulse, HardHat,
  Menu, ShieldCheck, ArrowRight, Layers, X, Sparkles, Filter,
  FileText, Clock, ExternalLink, Globe, Network, TrendingUp,
  AlertTriangle, CheckCircle2, ChevronRight, Copy, Eye, HelpCircle,
  Zap, CornerDownLeft, ChevronLeft
} from 'lucide-react';
import { DesktopSidebar, MobileSidebarContent } from '../components/AppSidebar';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { searchService, type ServerSearchResponse, type ServerSearchResult, type SuggestionItem } from '../services/searchService';
import { RECENT_SEARCHES, RECENTLY_ACCESSED_ENTITIES } from '../services/globalSearchDatabase';

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

export default function BuscaApproved() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 767px)');
  
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Read URL search params
  const queryParam = searchParams.get('q') || '';
  const typeParam = searchParams.get('type') || 'todos';
  const ufParam = searchParams.get('uf') || '';
  const sortParam = searchParams.get('sort') || 'relevancia';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  const [query, setQuery] = useState(queryParam);
  const [activeTypeTab, setActiveTypeTab] = useState(typeParam);
  const [selectedUf, setSelectedUf] = useState(ufParam);
  const [selectedSort, setSelectedSort] = useState(sortParam);
  const [page, setPage] = useState(pageParam);
  const [pageSize, setPageSize] = useState(20);

  const [isInputFocused, setIsInputFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [searchResponse, setSearchResponse] = useState<ServerSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drawerItem, setDrawerItem] = useState<ServerSearchResult | null>(null);

  const suggestAbortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<any>(null);

  // Synchronize state changes to URL Search Params
  const updateUrlParams = (newParams: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v && v !== 'todos' && v !== 'relevancia' && v !== 1) {
        params.set(k, String(v));
      } else {
        params.delete(k);
      }
    });
    setSearchParams(params);
  };

  // Debounced Autocomplete Suggest API call
  useEffect(() => {
    if (!query || query.trim().length < 2 || !isInputFocused) {
      setSuggestions([]);
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      searchService.suggest(query.trim())
        .then(res => setSuggestions(res.suggestions || []))
        .catch(() => setSuggestions([]));
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, isInputFocused]);

  // Execute Server-side Search on URL or filter changes
  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (!q) {
      setSearchResponse(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const typeFilter = activeTypeTab !== 'todos' ? activeTypeTab : undefined;

    searchService.executeSearch({
      q,
      types: typeFilter,
      uf: selectedUf || undefined,
      page,
      page_size: pageSize,
      sort: selectedSort
    })
      .then(res => {
        if (active) {
          setSearchResponse(res);
          setLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          setError('Não foi possível concluir a busca agora. Tente novamente.');
          setLoading(false);
        }
      });

    return () => { active = false; };
  }, [searchParams, activeTypeTab, selectedUf, selectedSort, page, pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsInputFocused(false);
    if (query.trim()) {
      setPage(1);
      updateUrlParams({ q: query.trim(), page: 1 });
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'empresa': return <Building2 size={16} color="#8B5CF6" />;
      case 'obra': return <HardHat size={16} color="#3B82F6" />;
      case 'transportador': return <Truck size={16} color="#06B6D4" />;
      case 'imovel_car': return <Sprout size={16} color="#22C55E" />;
      case 'estabelecimento_cnes': return <HeartPulse size={16} color="#EC4899" />;
      case 'municipio': return <Globe size={16} color="#F59E0B" />;
      case 'oportunidade': return <TrendingUp size={16} color="#10B981" />;
      default: return <FileText size={16} color="#6366F1" />;
    }
  };

  const totalPages = Math.ceil((searchResponse?.total || 0) / pageSize) || 1;

  return (
    <div data-ui-version="busca-global-approved-v2" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base, #090D16)', position: 'relative', overflow: 'hidden' }}>
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
              Busca Global Unificada
            </h1>
            {!isMobile && <p style={{ fontSize: 11, color: 'var(--text-tertiary, #64748B)', margin: 0, marginTop: 1 }}>Pesquisa server-side nas 4 verticais com validação de candidatos</p>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6366F1', fontWeight: 600, background: 'rgba(99,102,241,0.1)', padding: '4px 8px', borderRadius: 4 }}>
            <ShieldCheck size={14} /><span>Busca Server-Side 1:1</span>
          </div>
        </header>

        {/* Content Body */}
        <div style={{ padding: isMobile ? 12 : 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Form & Autocomplete Dropdown */}
          <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6366F1' }} />
                <input
                  data-testid="global-search-input"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
                  placeholder="Pesquisar empresa, CNPJ, obra, município, RNTRC, CNES, CAR, pessoa ou oportunidade…"
                  style={{
                    width: '100%', height: 44, paddingLeft: 42, paddingRight: 14, fontSize: 12, fontWeight: 500,
                    background: '#090D16', border: '1px solid #334155', borderRadius: 6, color: '#FFF'
                  }}
                />
              </div>

              <button
                type="submit"
                data-testid="btn-global-search"
                style={{ height: 44, padding: '0 24px', fontSize: 12, fontWeight: 700, background: '#6366F1', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>Buscar</span> <CornerDownLeft size={14} />
              </button>
            </form>

            {/* Server-Side Detected Types & Ambiguity Notice */}
            {searchResponse?.detected_types && searchResponse.detected_types.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#6366F1', fontWeight: 600, background: 'rgba(99,102,241,0.1)', padding: '4px 10px', borderRadius: 4, width: 'fit-content' }}>
                <Zap size={12} /> Candidato(s) identificado(s): {searchResponse.detected_types.join(', ').toUpperCase()}
              </div>
            )}

            {searchResponse?.ambiguity_message && (
              <div style={{ padding: '6px 10px', background: 'rgba(245,158,11,0.1)', border: '1px solid #F59E0B', borderRadius: 4, color: '#F59E0B', fontSize: 10, fontWeight: 600 }}>
                ⚠️ {searchResponse.ambiguity_message}
              </div>
            )}

            {/* Autocomplete Dropdown */}
            {suggestions.length > 0 && query && isInputFocused && (
              <div style={{
                position: 'absolute', top: 62, left: 16, right: 16, background: '#0F172A',
                border: '1px solid #6366F1', borderRadius: 8, zIndex: 100, maxHeight: 260, overflowY: 'auto',
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
              }}>
                {suggestions.map(s => (
                  <div
                    key={s.id}
                    data-testid={`autocomplete-item-${s.id}`}
                    onClick={() => { setQuery(s.title); updateUrlParams({ q: s.title, page: 1 }); }}
                    style={{ padding: '10px 14px', borderBottom: '1px solid #1E293B', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {getEntityIcon(s.type)}
                      <div>
                        <strong style={{ color: '#FFF', fontSize: 12 }}>{s.title}</strong>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>{s.subtitle} · {s.municipality}/{s.uf}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: '#6366F1' }}>
                      {s.identifier}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Useful Initial State */}
          {!query && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} color="#6366F1" /> Pesquisas Recentes
                </h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {RECENT_SEARCHES.map(term => (
                    <button
                      key={term}
                      onClick={() => { setQuery(term); updateUrlParams({ q: term, page: 1 }); }}
                      style={{ padding: '6px 12px', fontSize: 11, background: '#090D16', border: '1px solid #334155', color: '#F8FAFC', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Search size={11} color="#6366F1" /> {term}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface, #0F172A)', border: '1px solid var(--border-default, #1E293B)', borderRadius: 10, padding: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} color="#F59E0B" /> Atalhos de Investigação Direta
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Buscar Empresa por CNPJ', icon: Building2, color: '#8B5CF6', q: '00.000.000/0001-91' },
                    { label: 'Buscar Obra Pública', icon: HardHat, color: '#3B82F6', q: 'OBR-2026-PR01' },
                    { label: 'Buscar Município IBGE', icon: Globe, color: '#F59E0B', q: 'Curitiba' },
                    { label: 'Buscar Transportador RNTRC', icon: Truck, color: '#06B6D4', q: 'RNTRC 482109' },
                    { label: 'Buscar Imóvel CAR Agro', icon: Sprout, color: '#22C55E', q: 'PR-4106902-8812' },
                    { label: 'Buscar Saúde CNES', icon: HeartPulse, color: '#EC4899', q: 'CNES 2784102' }
                  ].map((sc, i) => (
                    <button
                      key={i}
                      onClick={() => { setQuery(sc.q); updateUrlParams({ q: sc.q, page: 1 }); }}
                      style={{ padding: 12, background: '#090D16', border: '1px solid #1E293B', borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}
                    >
                      <sc.icon size={16} color={sc.color} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#FFF' }}>{sc.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div style={{ padding: 24, textAlign: 'center', background: '#0F172A', borderRadius: 8, color: '#94A3B8' }}>
              Pesquisando nas fontes oficiais via API server-side...
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div style={{ padding: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', borderRadius: 8, color: '#EF4444', fontSize: 12 }}>
              {error}
            </div>
          )}

          {/* Search Results Area */}
          {query && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Summary Bar */}
              <div style={{ background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: '#FFF', margin: 0 }}>
                    {searchResponse ? `${searchResponse.total} resultados para "${searchResponse.query}"` : `Pesquisando nas 27 UFs...`}
                  </h2>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>
                    {searchResponse ? `Página ${searchResponse.page} de ${totalPages} · Exibindo ${searchResponse.results.length} registros server-side` : `Consultando o corpus nacional`}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <BrazilUfSelect
                    dataTestId="uf-filter-select"
                    value={selectedUf}
                    onChange={(val) => { setSelectedUf(val); setPage(1); updateUrlParams({ uf: val, page: 1 }); }}
                  />

                  <select
                    value={selectedSort}
                    onChange={e => { setSelectedSort(e.target.value); updateUrlParams({ sort: e.target.value }); }}
                    style={{ height: 30, background: '#090D16', border: '1px solid #334155', color: '#FFF', fontSize: 11, borderRadius: 4, padding: '0 8px' }}
                  >
                    <option value="relevancia">Mais Relevante</option>
                    <option value="exato">Correspondência Exata</option>
                    <option value="recente">Atualização Recente</option>
                    <option value="completude">Maior Completude</option>
                  </select>
                </div>
              </div>

              {/* Entity Type Tabs (Server-side Breakdown) */}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', borderBottom: '1px solid #1E293B', paddingBottom: 6 }}>
                {[
                  { id: 'todos', label: `Todos (${searchResponse?.total || 0})` },
                  { id: 'empresas', label: `Empresas (${searchResponse?.counts_by_type?.empresas || 0})` },
                  { id: 'obras', label: `Obras (${searchResponse?.counts_by_type?.obras || 0})` },
                  { id: 'transportadores', label: `Transportadores (${searchResponse?.counts_by_type?.transportadores || 0})` },
                  { id: 'agro', label: `Agro CAR (${searchResponse?.counts_by_type?.imoveis_car || 0})` },
                  { id: 'saude', label: `Saúde CNES (${searchResponse?.counts_by_type?.estabelecimentos_cnes || 0})` },
                  { id: 'municipios', label: `Municípios (${searchResponse?.counts_by_type?.municipios || 0})` },
                  { id: 'oportunidades', label: `Oportunidades (${searchResponse?.counts_by_type?.oportunidades || 0})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTypeTab(tab.id); setPage(1); updateUrlParams({ type: tab.id, page: 1 }); }}
                    style={{
                      height: 30, padding: '0 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
                      background: activeTypeTab === tab.id ? '#6366F1' : '#0F172A',
                      color: activeTypeTab === tab.id ? '#FFF' : '#94A3B8',
                      border: '1px solid #334155'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Results Cards List */}
              {searchResponse && searchResponse.results && searchResponse.results.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {searchResponse.results.map(item => (
                    <div
                      key={item.entity_id}
                      data-testid={`search-result-card-${item.entity_id}`}
                      style={{
                        background: '#0F172A', border: '1px solid #1E293B', borderRadius: 8, padding: 14,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'border 0.15s'
                      }}
                      onClick={() => setDrawerItem(item)}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6366F1')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1E293B')}
                    >
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ marginTop: 2 }}>{getEntityIcon(item.entity_type)}</div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#FFF', margin: 0 }}>{item.primary_label}</h3>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: '#6366F1' }}>
                              {item.identifier}
                            </span>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                              {item.match_type} ({item.match_score}%)
                            </span>
                          </div>
                          <p style={{ fontSize: 11, color: '#94A3B8', margin: '4px 0 0 0' }}>
                            {item.secondary_label} · {item.municipality}/{item.uf} · Racional: <strong>{item.match_reason}</strong>
                          </p>

                          <div style={{ fontSize: 10, color: '#64748B', marginTop: 6 }}>
                            Fonte Auditada: <strong>{item.source}</strong> · Qualidade: <strong style={{ color: '#22C55E' }}>{item.quality_score}%</strong> · Atualizado em {item.updated_at}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(item.destination_route); }}
                          style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, background: '#6366F1', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Abrir Detalhe
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', background: '#0F172A', borderRadius: 8, color: '#94A3B8', fontSize: 12 }}>
                  Nenhum dado disponível para este recorte.
                  <div style={{ fontSize: 11, marginTop: 8, color: '#64748B' }}>Sugestão: revise a grafia do termo, pesquise somente os números do identificador ou altere os filtros.</div>
                </div>
              )}

              {/* Server-Side Pagination Controls */}
              {searchResponse && searchResponse.total > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 11, color: '#94A3B8' }}>
                  <span>Exibindo página {searchResponse.page} de {totalPages}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      disabled={page === 1}
                      onClick={() => { setPage(prev => Math.max(prev - 1, 1)); updateUrlParams({ page: Math.max(page - 1, 1) }); }}
                      style={{ background: '#0F172A', border: '1px solid #334155', color: '#FFF', padding: '4px 10px', borderRadius: 4, fontSize: 10, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      <ChevronLeft size={10} style={{ display: 'inline' }} /> Anterior
                    </button>
                    <button
                      disabled={page === totalPages}
                      onClick={() => { setPage(prev => Math.min(prev + 1, totalPages)); updateUrlParams({ page: Math.min(page + 1, totalPages) }); }}
                      style={{ background: '#0F172A', border: '1px solid #334155', color: '#FFF', padding: '4px 10px', borderRadius: 4, fontSize: 10, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
                    >
                      Próxima <ChevronRight size={10} style={{ display: 'inline' }} />
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>

      {/* Inspection Side Drawer */}
      {drawerItem && (
        <div style={{
          position: 'fixed', top: 0, right: 0, width: isMobile ? '100vw' : 420, height: '100vh',
          background: '#0F172A', borderLeft: '1px solid #6366F1', zIndex: 300, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '-10px 0 30px rgba(0,0,0,0.8)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {getEntityIcon(drawerItem.entity_type)}
              <h3 style={{ fontSize: 14, fontWeight: 800, color: '#FFF', margin: 0 }}>Inspeção Rápida de Entidade</h3>
            </div>
            <X size={18} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={() => setDrawerItem(null)} />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 11 }}>
            <div>
              <span style={{ fontSize: 10, color: '#6366F1', textTransform: 'uppercase', fontWeight: 700 }}>{drawerItem.entity_type} · {drawerItem.verticals.join(', ')}</span>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#FFF', margin: '4px 0 2px 0' }}>{drawerItem.primary_label}</h2>
              <div style={{ color: '#94A3B8' }}>{drawerItem.secondary_label}</div>
            </div>

            <div style={{ background: '#090D16', padding: 12, borderRadius: 6, border: '1px solid #1E293B' }}>
              <div><strong>Identificador:</strong> {drawerItem.identifier}</div>
              <div><strong>Localização:</strong> {drawerItem.municipality}/{drawerItem.uf} (IBGE: {drawerItem.ibge})</div>
              <div><strong>Status:</strong> {drawerItem.status}</div>
              <div><strong>Qualidade Cadastral:</strong> {drawerItem.quality_score}%</div>
            </div>

            <div style={{ background: '#090D16', padding: 12, borderRadius: 6, border: '1px solid #1E293B' }}>
              <strong style={{ color: '#FFF' }}>Match & Racional:</strong>
              <div style={{ color: '#22C55E', marginTop: 4 }}>{drawerItem.match_type} ({drawerItem.match_score}% de confiança)</div>
              <div style={{ color: '#94A3B8', marginTop: 2 }}>{drawerItem.match_reason}</div>
              <div style={{ color: '#94A3B8', marginTop: 2 }}>Fonte: {drawerItem.source}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid #1E293B' }}>
            <button
              onClick={() => { navigate(drawerItem.destination_route); setDrawerItem(null); }}
              style={{ width: '100%', height: 34, background: '#6366F1', color: '#FFF', fontWeight: 700, fontSize: 11, border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              Abrir Ficha Completa
            </button>
            <button
              onClick={() => { navigate(`/relacionamentos?query=${encodeURIComponent(drawerItem.identifier)}`); setDrawerItem(null); }}
              style={{ width: '100%', height: 34, background: '#1E293B', color: '#FFF', fontWeight: 600, fontSize: 11, border: '1px solid #334155', borderRadius: 6, cursor: 'pointer' }}
            >
              Abrir Relacionamentos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
